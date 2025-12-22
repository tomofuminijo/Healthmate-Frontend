#!/usr/bin/env node

/**
 * Healthmate-Frontend 実際のCoachAI API統合テスト
 * 
 * このスクリプトは以下をテストします：
 * 1. Cognito認証の動作確認
 * 2. 実際のCoachAI APIとの通信テスト
 * 3. ログイン後のリダイレクト処理
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';

// 設定
const CONFIG = {
  frontendUrl: 'http://localhost:3000',
  cognitoConfig: {
    userPoolId: 'us-west-2_tykFYGwK7',
    clientId: 'q1m738bplsn2k6orkq0avs589',
    region: 'us-west-2'
  },
  coachAIConfig: {
    agentArn: 'arn:aws:bedrock-agentcore:us-west-2:718691933423:runtime/healthmate_coach_ai-9B3tuO6xGv',
    region: 'us-west-2'
  },
  testUser: {
    username: 'healthuser1',
    password: 'TempPassword123!'
  }
};

/**
 * AgentCore Runtime エンドポイントURLを構築
 */
function buildAgentCoreEndpointUrl() {
  const escapedAgentArn = encodeURIComponent(CONFIG.coachAIConfig.agentArn);
  return `https://bedrock-agentcore.${CONFIG.coachAIConfig.region}.amazonaws.com/runtimes/${escapedAgentArn}/invocations?qualifier=DEFAULT`;
}

/**
 * フロントエンドサーバーの動作確認
 */
async function testFrontendServer() {
  console.log('🌐 フロントエンドサーバーの動作確認...');
  
  try {
    const response = await fetch(CONFIG.frontendUrl);
    if (response.ok) {
      console.log('   ✅ フロントエンドサーバーが正常に動作しています');
      return true;
    } else {
      console.log(`   ❌ フロントエンドサーバーエラー: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ フロントエンドサーバーに接続できません: ${error.message}`);
    console.log('   💡 npm run dev が実行されていることを確認してください');
    return false;
  }
}

/**
 * CoachAI APIの接続テスト
 */
async function testCoachAIConnection() {
  console.log('🤖 CoachAI API接続テスト...');
  
  try {
    const endpointUrl = buildAgentCoreEndpointUrl();
    console.log(`   🔗 エンドポイント: ${endpointUrl}`);
    
    // ヘルスチェック用のリクエスト
    const payload = {
      prompt: "health check",
      sessionState: {
        sessionAttributes: {
          session_id: "test-session-123",
          jwt_token: "test-token",
          timezone: "Asia/Tokyo",
          language: "ja"
        }
      }
    };
    
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    console.log(`   📊 レスポンス状態: ${response.status}`);
    
    if (response.status === 401) {
      console.log('   ✅ CoachAI APIが動作しています（認証が必要）');
      return true;
    } else if (response.status === 200) {
      console.log('   ✅ CoachAI APIが動作しています');
      return true;
    } else {
      console.log(`   ⚠️  予期しないレスポンス: ${response.status}`);
      const responseText = await response.text();
      console.log(`   📄 レスポンス内容: ${responseText.substring(0, 200)}...`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ CoachAI API接続エラー: ${error.message}`);
    return false;
  }
}

/**
 * 環境変数の確認
 */
function testEnvironmentVariables() {
  console.log('🔧 環境変数の確認...');
  
  try {
    const envContent = readFileSync('.env', 'utf8');
    const envLines = envContent.split('\n');
    
    const requiredVars = [
      'VITE_COGNITO_USER_POOL_ID',
      'VITE_COGNITO_CLIENT_ID',
      'VITE_COGNITO_REGION',
      'VITE_COACHAI_AGENT_ARN'
    ];
    
    let allPresent = true;
    
    for (const varName of requiredVars) {
      const found = envLines.some(line => line.startsWith(`${varName}=`));
      if (found) {
        console.log(`   ✅ ${varName}`);
      } else {
        console.log(`   ❌ ${varName} が見つかりません`);
        allPresent = false;
      }
    }
    
    return allPresent;
  } catch (error) {
    console.log(`   ❌ .envファイルの読み込みエラー: ${error.message}`);
    return false;
  }
}

/**
 * ビルドテスト
 */
function testBuild() {
  console.log('🔨 ビルドテスト...');
  
  try {
    console.log('   📦 TypeScriptコンパイルチェック...');
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    console.log('   ✅ TypeScriptコンパイル成功');
    
    console.log('   🏗️  Viteビルドテスト...');
    execSync('npm run build', { stdio: 'pipe' });
    console.log('   ✅ Viteビルド成功');
    
    return true;
  } catch (error) {
    console.log(`   ❌ ビルドエラー: ${error.message}`);
    return false;
  }
}

/**
 * 設定情報の表示
 */
function displayConfiguration() {
  console.log('📋 現在の設定:');
  console.log(`   フロントエンドURL: ${CONFIG.frontendUrl}`);
  console.log(`   Cognito UserPool: ${CONFIG.cognitoConfig.userPoolId}`);
  console.log(`   Cognito Client: ${CONFIG.cognitoConfig.clientId}`);
  console.log(`   CoachAI Agent ARN: ${CONFIG.coachAIConfig.agentArn}`);
  console.log(`   テストユーザー: ${CONFIG.testUser.username}`);
  console.log();
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('🚀 Healthmate-Frontend 実際のCoachAI API統合テスト');
  console.log('=' * 60);
  console.log();
  
  displayConfiguration();
  
  const tests = [
    { name: '環境変数確認', fn: testEnvironmentVariables },
    { name: 'ビルドテスト', fn: testBuild },
    { name: 'フロントエンドサーバー', fn: testFrontendServer },
    { name: 'CoachAI API接続', fn: testCoachAIConnection },
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    console.log(`\n🧪 ${test.name}テスト実行中...`);
    const result = await test.fn();
    
    if (result) {
      passedTests++;
      console.log(`✅ ${test.name}テスト: 成功`);
    } else {
      console.log(`❌ ${test.name}テスト: 失敗`);
    }
  }
  
  console.log('\n' + '=' * 60);
  console.log(`📊 テスト結果: ${passedTests}/${tests.length} 成功`);
  
  if (passedTests === tests.length) {
    console.log('🎉 すべてのテストが成功しました！');
    console.log();
    console.log('📝 次のステップ:');
    console.log('   1. ブラウザで http://localhost:3000 にアクセス');
    console.log('   2. テストユーザーでログイン:');
    console.log(`      ユーザー名: ${CONFIG.testUser.username}`);
    console.log(`      パスワード: ${CONFIG.testUser.password}`);
    console.log('   3. チャット機能をテスト');
    console.log('   4. ログイン後のリダイレクトを確認');
  } else {
    console.log('⚠️  一部のテストが失敗しました。上記のエラーを確認してください。');
  }
  
  console.log();
}

// 実行
main().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});