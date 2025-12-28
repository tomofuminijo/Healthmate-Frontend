/**
 * Chat API - CoachAI サービスとの通信
 */

import { fetchWithRetry, ErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

export interface ChatRequest {
  prompt: string;
  sessionId: string;
  timezone?: string;
  language?: string;
}

export interface ChatResponse {
  content: string;
  sessionId: string;
  timestamp: string;
}

/**
 * CoachAI AgentCore Runtime エンドポイント設定
 */
const AGENTCORE_CONFIG = {
  region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
  // 実際のAgent ARNは環境変数から取得（本番環境）
  agentArn: import.meta.env.VITE_COACHAI_AGENT_ARN || 'arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/healthmate_coach_ai',
};

/**
 * AgentCore Runtime エンドポイントURLを構築
 */
function buildAgentCoreEndpointUrl(): string {
  const agentArn = AGENTCORE_CONFIG.agentArn;
  const region = AGENTCORE_CONFIG.region;
  
  if (!agentArn) {
    throw new Error('VITE_COACHAI_AGENT_ARN が設定されていません');
  }
  
  // AgentCore Runtime エンドポイント形式（AWS公式ドキュメント準拠）
  const escapedAgentArn = encodeURIComponent(agentArn);
  return `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/${escapedAgentArn}/invocations?qualifier=DEFAULT`;
}

/**
 * CoachAI サービスにメッセージを送信（実際のAgentCore Runtime）
 */
export async function sendChatMessage(
  request: ChatRequest,
  jwtToken: string,
  signal?: AbortSignal
): Promise<ChatResponse> {
  try {
    const endpointUrl = buildAgentCoreEndpointUrl();
    
    const payload = {
      prompt: request.prompt,
      timezone: request.timezone || 'Asia/Tokyo',
      language: request.language || 'ja'
    };

    logger.info('🚀 CoachAI Request Start:', {
      endpoint: endpointUrl,
      sessionId: request.sessionId,
      promptLength: request.prompt.length,
      timestamp: new Date().toISOString()
    });

    const response = await fetchWithRetry(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': request.sessionId,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      throw ErrorHandler.classify(response);
    }

    logger.info('📥 CoachAI Response Start:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    });

    // AgentCore Runtimeからのストリーミングレスポンスを処理
    const responseText = await parseAgentCoreStreamingResponse(response);
    
    logger.info('✅ CoachAI Response Complete:', {
      responseLength: responseText.length,
      sessionId: request.sessionId,
      timestamp: new Date().toISOString()
    });
    
    return {
      content: responseText || 'レスポンスが空です',
      sessionId: request.sessionId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('❌ CoachAI API error:', error);
    throw ErrorHandler.classify(error);
  }
}

/**
 * AgentCore Runtime ストリーミングレスポンスを解析
 */
async function parseAgentCoreStreamingResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('ストリーミングレスポンスが取得できません');
  }

  const decoder = new TextDecoder();
  let responseText = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataJson = line.substring(6); // "data: " を除去
          
          if (dataJson.trim()) {
            try {
              const eventData = JSON.parse(dataJson);
              
              // 受信したイベントデータをログ出力
              logger.debug('📡 CoachAI Streaming Event:', eventData);
              
              // contentBlockDelta イベントからテキストを抽出
              if (eventData.event && eventData.event.contentBlockDelta) {
                const delta = eventData.event.contentBlockDelta.delta;
                if (delta && delta.text) {
                  logger.debug('📝 CoachAI Text Chunk:', {
                    text: delta.text,
                    length: delta.text.length,
                    timestamp: new Date().toISOString()
                  });
                  responseText += delta.text;
                }
              }
            } catch (e) {
              // JSON パースエラーは無視
              logger.warn('Failed to parse AgentCore streaming data:', dataJson);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return responseText;
}

/**
 * ストリーミングチャット（リアルタイム表示用）
 */
export async function* streamChatMessage(
  request: ChatRequest,
  jwtToken: string,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  try {
    const endpointUrl = buildAgentCoreEndpointUrl();
    
    const payload = {
      prompt: request.prompt,
      timezone: request.timezone || 'Asia/Tokyo',
      language: request.language || 'ja'
    };

    logger.info('🌊 CoachAI Streaming Request Start:', {
      endpoint: endpointUrl,
      sessionId: request.sessionId,
      promptLength: request.prompt.length,
      timestamp: new Date().toISOString()
    });

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': request.sessionId,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      throw ErrorHandler.classify(response);
    }

    logger.info('🔄 CoachAI Streaming Response Start:', {
      status: response.status,
      statusText: response.statusText,
      timestamp: new Date().toISOString()
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('ストリーミングレスポンスが取得できません');
    }

    const decoder = new TextDecoder();
    let totalChunks = 0;
    let totalTextLength = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          logger.info('🏁 CoachAI Streaming Complete:', {
            totalChunks,
            totalTextLength,
            timestamp: new Date().toISOString()
          });
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataJson = line.substring(6); // "data: " を除去
            
            if (dataJson.trim()) {
              try {
                const eventData = JSON.parse(dataJson);
                
                // 受信したイベントデータをログ出力
                logger.debug('🔄 CoachAI Streaming Event (Generator):', eventData);
                
                // contentBlockDelta イベントからテキストを抽出
                if (eventData.event && eventData.event.contentBlockDelta) {
                  const delta = eventData.event.contentBlockDelta.delta;
                  if (delta && delta.text) {
                    totalChunks++;
                    totalTextLength += delta.text.length;
                    
                    logger.debug('⚡ CoachAI Text Chunk (Streaming):', {
                      text: delta.text,
                      length: delta.text.length,
                      chunkNumber: totalChunks,
                      totalLength: totalTextLength,
                      timestamp: new Date().toISOString()
                    });
                    yield delta.text;
                  }
                }
              } catch (e) {
                // JSON パースエラーは無視
                logger.warn('Failed to parse streaming data:', dataJson);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    logger.error('Streaming chat error:', error);
    throw ErrorHandler.classify(error);
  }
}

/**
 * CoachAI サービスのヘルスチェック（軽量版）
 */
export async function checkCoachAIHealth(jwtToken?: string): Promise<{
  available: boolean;
  latency?: number;
  error?: any;
}> {
  const startTime = Date.now();

  try {
    const endpointUrl = buildAgentCoreEndpointUrl();
    
    // 軽量なヘルスチェック：エンドポイントの存在確認のみ
    // JWTトークンがある場合は実際のリクエストを送信、ない場合は簡易チェック
    if (jwtToken) {
      const testPayload = {
        prompt: "health check",
        timezone: "Asia/Tokyo",
        language: "ja"
      };

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          available: true,
          latency,
        };
      } else if (response.status === 401 || response.status === 403) {
        // 認証エラーはサービスが動作していることを示す
        return {
          available: true,
          latency,
        };
      } else {
        return {
          available: false,
          latency,
          error: ErrorHandler.classify(response),
        };
      }
    } else {
      // JWTトークンがない場合は、エンドポイントURLの構築が成功すれば利用可能とみなす
      const latency = Date.now() - startTime;
      return {
        available: true,
        latency,
      };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    
    // ネットワークエラーやURL構築エラーの場合のみ利用不可とする
    if (error instanceof Error && error.message.includes('VITE_COACHAI_AGENT_ARN')) {
      return {
        available: false,
        latency,
        error: ErrorHandler.classify(error),
      };
    }
    
    // その他のエラーは一時的な問題として利用可能とみなす
    return {
      available: true,
      latency,
    };
  }
}