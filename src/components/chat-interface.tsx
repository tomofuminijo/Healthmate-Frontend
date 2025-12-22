import React from 'react';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import { ErrorDisplay } from './error-display';
import { useChat } from '@/contexts/chat-context';
import { useAuth } from '@/contexts/auth-context';
import { ErrorHandler, AppError } from '@/lib/error-handler';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  className?: string;
}

/**
 * ChatInterface コンポーネント
 * Vercel AI SDK統合とエラーハンドリング機能
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({ className }) => {
  const { currentChatSession, addMessage, updateMessage } = useChat();
  const { getJwtToken } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<AppError | null>(null);
  const [serviceHealth, setServiceHealth] = React.useState<{
    available: boolean;
    lastChecked?: Date;
  }>({ available: true });

  /**
   * サービスヘルスチェック（CoachAI API優先）
   */
  const performHealthCheck = React.useCallback(async () => {
    try {
      // JWTトークンを取得してヘルスチェックに使用
      const jwtToken = await getJwtToken();
      
      // 実際のCoachAI APIのヘルスチェックを試行
      const { checkCoachAIHealth } = await import('@/api/chat');
      const health = await checkCoachAIHealth(jwtToken || undefined);
      
      setServiceHealth({
        available: health.available,
        lastChecked: new Date(),
      });
      
      if (health.available) {
        console.log('✅ CoachAI サービスが利用可能です');
        // エラー状態をクリア
        if (error) {
          setError(null);
        }
      } else if (health.error) {
        console.warn('⚠️ CoachAI サービスのヘルスチェックでエラー:', health.error);
        setError(health.error);
      }
    } catch (err) {
      console.warn('⚠️ CoachAI ヘルスチェックに失敗。モックモードで動作します:', err);
      
      // ヘルスチェック失敗は警告レベルとして扱う（モックで動作可能）
      setServiceHealth({
        available: true, // モックAPIで動作可能
        lastChecked: new Date(),
      });
      
      // エラー表示はしない（モックで動作するため）
      setError(null);
    }
  }, [error, getJwtToken]);

  /**
   * 初回ヘルスチェック
   */
  React.useEffect(() => {
    performHealthCheck();
  }, [performHealthCheck]);

  /**
   * メッセージ送信処理（実際のCoachAI API優先）
   */
  const handleSendMessage = async (content: string) => {
    // エラー状態をクリア
    setError(null);

    // ユーザーメッセージをローカルセッションに保存
    addMessage({
      role: 'user',
      content,
    });

    setIsLoading(true);

    try {
      // JWT トークンを取得
      const jwtToken = await getJwtToken();
      if (!jwtToken) {
        throw new Error('認証トークンが取得できません');
      }

      if (!currentChatSession) {
        throw new Error('チャットセッションが見つかりません');
      }

      // 実際のCoachAI APIを最初に試行（ストリーミング）
      try {
        console.log('🔗 CoachAI API呼び出し開始 (ストリーミング):', {
          sessionId: currentChatSession.id,
          hasJwtToken: !!jwtToken,
          jwtTokenLength: jwtToken?.length
        });

        const { streamChatMessage } = await import('@/api/chat');
        
        // 空のAIメッセージを先に作成
        const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        addMessage({
          role: 'assistant',
          content: '',
          id: aiMessageId
        });

        let accumulatedContent = '';
        
        // ストリーミングでチャンクを受信
        for await (const chunk of streamChatMessage(
          {
            prompt: content,
            sessionId: currentChatSession.id,
            timezone: 'Asia/Tokyo',
            language: 'ja'
          },
          jwtToken
        )) {
          accumulatedContent += chunk;
          
          // チャンクごとにメッセージを更新（addMessageを使用して既存メッセージを更新）
          addMessage({
            role: 'assistant',
            content: accumulatedContent,
            id: aiMessageId
          });
        }
        
        console.log('✅ 実際のCoachAI APIからストリーミング応答完了:', {
          responseLength: accumulatedContent.length,
          sessionId: currentChatSession.id
        });
        
      } catch (apiError) {
        console.warn('⚠️ 実際のCoachAI APIが利用できません。モックAPIにフォールバック:', {
          error: apiError,
          errorType: apiError?.constructor?.name,
          errorMessage: apiError?.message
        });
        
        // モックAPIにフォールバック
        const { mockChatAPI } = await import('@/api/mock-chat-server');
        
        const response = await mockChatAPI({
          prompt: content,
          sessionState: {
            sessionAttributes: {
              session_id: currentChatSession.id,
              jwt_token: jwtToken,
              timezone: 'Asia/Tokyo',
              language: 'ja'
            }
          }
        });

        // AIメッセージをローカルセッションに保存
        addMessage({
          role: 'assistant',
          content: response.content + '\n\n*（注：モックAPIからの応答です）*',
        });
        
        console.log('✅ モックAPIから応答を取得しました');
      }
      
      setIsLoading(false);
      
    } catch (err) {
      console.error('Chat error:', err);
      const appError = ErrorHandler.classify(err);
      setError(appError);
      
      // エラーメッセージをチャットに追加
      addMessage({
        role: 'assistant',
        content: `申し訳ございません。${appError.message}`,
      });
      setIsLoading(false);
    }
  };

  /**
   * エラーリトライ処理
   */
  const handleRetry = React.useCallback(async () => {
    setError(null);
    await performHealthCheck();
  }, [performHealthCheck]);

  /**
   * エラー解除処理
   */
  const handleDismissError = React.useCallback(() => {
    setError(null);
  }, []);

  /**
   * 表示用メッセージ
   */
  const displayMessages = React.useMemo(() => {
    if (!currentChatSession) return [];
    return currentChatSession.messages;
  }, [currentChatSession?.messages]);

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-background",
        className
      )}
      data-testid="chat-interface"
    >
      {/* エラー表示エリア */}
      {error && (
        <div className="p-4 border-b">
          <ErrorDisplay
            error={error}
            onRetry={error.retryable ? handleRetry : undefined}
            onDismiss={handleDismissError}
            compact
          />
        </div>
      )}

      {/* サービス状態表示 */}
      {!serviceHealth.available && !error && (
        <div className="p-4 border-b bg-yellow-50 dark:bg-yellow-950">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-sm">
              CoachAI サービスの状態を確認中...
            </span>
          </div>
        </div>
      )}

      {/* チャット履歴表示エリア */}
      <MessageList 
        messages={displayMessages}
        className="flex-1"
      />

      {/* メッセージ入力エリア */}
      <MessageInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        disabled={!serviceHealth.available && !!error}
        placeholder={
          !serviceHealth.available && !!error
            ? "サービスが利用できません..."
            : "健康について何でもお聞きください..."
        }
      />
    </div>
  );
};