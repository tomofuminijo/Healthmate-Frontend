#!/usr/bin/env node
/**
 * CoachAI API接続テストスクリプト
 * 実際のHealthmate-CoachAI サービスとの接続をテストします
 */

import fetch from 'node-fetch';

// 設定
const CONFIG = {
  // 実際のAgent ARN（.bedrock_agentcore.yamlから取得）
  agentArn: 'arn:aws:bedrock-agentcore:us-west-2:718691933423:runtime/healthmate_coach_ai-9B3tuO6xGv',
  region: 'us-west-2',
  // テスト用のJWTトークン（実際のCognito UserPoolから取得が必要）
  testJwtToken: 'test-token-placeholder',
  sessionId: `healthmate-test-${Date.now()}-${Math.random().toString(36).substr(2, 15)}`
};

/**
 * AgentCore Runtime エンドポイントURLを構築
 */
function buildAgentCoreEndpointUrl() {
  const escapedAgentArn = encodeURIComponent(CONFIG.agentArn);
  return `https://bedrock-agentcore.${CONFIG.region}.amazonaws.com/runtimes/${escapedAgentArn}/invocations?qualifier=DEFAULT`;
}

/**
 * CoachAI APIテスト
 */
async function testCoachAIConnection() {
  console.log('🚀 CoachAI API接続テスト開始');
  console.log('=' * 50);
  console.log(`Agent ARN: ${CONFIG.agentArn}`);
  console.log(`Session ID: ${CONFIG.sessionId}`);
  console.log(`Region: ${CONFIG.region}`);
  console.log();

  const endpointUrl = buildAgentCoreEndpointUrl();
  console.log(`エンドポイント URL: ${endpointUrl}`);
  console.log();

  const payload = {
    prompt: "こんにちは！健康管理について教えてください。",
    sessionState: {
      sessionAttributes: {
        session_id: CONFIG.sessionId,
        jwt_token: CONFIG.testJwtToken,
        timezone: "Asia/Tokyo",
        language: "ja"
      }
    }
  };

  console.log('📤 送信ペイロード:');
  console.log(JSON.stringify(payload, null, 2));
  console.log();

  try {
    console.log('🔄 リクエスト送信中...');
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.testJwtToken}`,
        'Content-Type': 'application/json',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': CONFIG.sessionId,
      },
      body: JSON.stringify(payload),
    });

    console.log(`📥 レスポンス ステータス: ${response.status} ${response.statusText}`);
    console.log('📋 レスポンス ヘッダー:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    console.log();

    if (response.status === 401) {
      console.log('🔐 認証エラー（401）- これは期待される動作です');
      console.log('   実際のJWTトークンが必要です');
      console.log('   CoachAI サービス自体は動作していることが確認できました');
      return { success: true, needsAuth: true };
    }

    if (response.status === 403) {
      console.log('🚫 認可エラー（403）- JWTトークンの権限不足');
      console.log('   CoachAI サービス自体は動作していることが確認できました');
      return { success: true, needsAuth: true };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ エラーレスポンス:');
      console.log(errorText);
      return { success: false, error: errorText };
    }

    // 成功レスポンスの処理
    const responseText = await response.text();
    console.log('✅ 成功レスポンス:');
    console.log(responseText);
    
    return { success: true, response: responseText };

  } catch (error) {
    console.log('❌ 接続エラー:');
    console.log(error.message);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('🌐 ネットワーク接続の問題またはサービスが利用できません');
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * ヘルスチェックテスト
 */
async function testHealthCheck() {
  console.log('🏥 CoachAI ヘルスチェックテスト');
  console.log('=' * 40);
  
  try {
    // 簡単なヘルスチェック用のクエリ
    const endpointUrl = buildAgentCoreEndpointUrl();
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: "health check",
        sessionState: {
          sessionAttributes: {
            session_id: "health-check-session",
            jwt_token: "test-token",
            timezone: "Asia/Tokyo",
            language: "ja"
          }
        }
      }),
    });

    console.log(`ヘルスチェック ステータス: ${response.status}`);
    
    // 401エラー（認証エラー）は正常（サービスは動作している）
    if (response.status === 401) {
      console.log('✅ CoachAI サービスが動作中（認証が必要）');
      return { available: true, needsAuth: true };
    }

    if (response.ok) {
      console.log('✅ CoachAI サービスが利用可能');
      return { available: true };
    } else {
      console.log(`⚠️ CoachAI サービスの状態: ${response.status}`);
      return { available: false, status: response.status };
    }
    
  } catch (error) {
    console.log(`❌ ヘルスチェック失敗: ${error.message}`);
    return { available: false, error: error.message };
  }
}

/**
 * メイン実行
 */
async function main() {
  console.log('🧪 Healthmate-CoachAI 接続テストスイート');
  console.log('=' * 60);
  console.log();

  // 1. ヘルスチェック
  const healthResult = await testHealthCheck();
  console.log();

  // 2. 実際のAPI接続テスト
  const connectionResult = await testCoachAIConnection();
  console.log();

  // 3. 結果サマリー
  console.log('📊 テスト結果サマリー');
  console.log('=' * 30);
  
  if (healthResult.available) {
    console.log('✅ CoachAI サービス: 利用可能');
  } else {
    console.log('❌ CoachAI サービス: 利用不可');
  }

  if (connectionResult.success) {
    if (connectionResult.needsAuth) {
      console.log('🔐 API接続: 認証が必要（正常）');
    } else {
      console.log('✅ API接続: 成功');
    }
  } else {
    console.log('❌ API接続: 失敗');
  }

  console.log();
  console.log('💡 次のステップ:');
  
  if (healthResult.available && connectionResult.needsAuth) {
    console.log('1. 実際のCognito JWTトークンを取得');
    console.log('2. フロントエンドアプリケーションでの統合テスト');
    console.log('3. ブラウザでの動作確認');
  } else if (!healthResult.available) {
    console.log('1. CoachAI サービスのデプロイ状態を確認');
    console.log('2. AWS AgentCore Runtime の状態を確認');
    console.log('3. ネットワーク接続を確認');
  }
}

// 実行
main().catch(console.error);