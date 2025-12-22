#!/usr/bin/env node

/**
 * Healthmate-Frontend チャット統合テスト
 * 実際のCoachAI APIとの接続をテストします
 */

import { chromium } from 'playwright';

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  // 実際のCognito認証情報（テスト用）
  testUser: {
    username: 'healthuser1',
    password: 'HealthUser123!'
  }
};

async function runChatIntegrationTest() {
  console.log('🚀 Healthmate-Frontend チャット統合テスト開始');
  console.log('=' * 60);

  const browser = await chromium.launch({ 
    headless: false, // ブラウザを表示してテスト
    slowMo: 1000 // 操作を見やすくするため
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. ログインページにアクセス
    console.log('📝 Step 1: ログインページにアクセス');
    await page.goto(`${TEST_CONFIG.baseUrl}/login`);
    await page.waitForLoadState('networkidle');

    // 2. ログイン実行
    console.log('🔐 Step 2: Cognito認証でログイン');
    await page.fill('input[type="text"]', TEST_CONFIG.testUser.username);
    await page.fill('input[type="password"]', TEST_CONFIG.testUser.password);
    await page.click('button[type="submit"]');

    // ダッシュボードへのリダイレクトを待機
    console.log('⏳ ダッシュボードへのリダイレクトを待機...');
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeout });
    console.log('✅ ダッシュボードにリダイレクト成功');

    // 3. チャットインターフェースの確認
    console.log('💬 Step 3: チャットインターフェースの確認');
    await page.waitForSelector('[data-testid="chat-interface"]', { timeout: 10000 });
    console.log('✅ チャットインターフェースが表示されました');

    // 4. CoachAI サービスの状態確認
    console.log('🔍 Step 4: CoachAI サービスの状態確認');
    
    // コンソールログを監視
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
      console.log(`[Browser Console] ${msg.text()}`);
    });

    // ネットワークエラーを監視
    const networkErrors = [];
    page.on('response', response => {
      if (!response.ok() && response.url().includes('bedrock-agentcore')) {
        networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    // 5. テストメッセージの送信
    console.log('📤 Step 5: テストメッセージの送信');
    const testMessage = 'こんにちは！健康について相談したいです。';
    
    await page.fill('textarea[placeholder*="健康について"]', testMessage);
    await page.click('button[type="submit"]');
    
    console.log(`✅ メッセージ送信: "${testMessage}"`);

    // 6. AI応答の待機
    console.log('🤖 Step 6: AI応答の待機');
    
    // メッセージが追加されるのを待機（最大30秒）
    await page.waitForFunction(() => {
      const messages = document.querySelectorAll('[data-role="assistant"]');
      return messages.length > 0;
    }, { timeout: TEST_CONFIG.timeout });

    const aiMessages = await page.$$eval('[data-role="assistant"]', elements => 
      elements.map(el => el.textContent)
    );

    if (aiMessages.length > 0) {
      console.log('✅ AI応答を受信しました:');
      aiMessages.forEach((msg, index) => {
        console.log(`   ${index + 1}. ${msg.substring(0, 100)}...`);
      });
    }

    // 7. テスト結果の評価
    console.log('\n📊 テスト結果の評価');
    console.log('-' * 40);

    // ネットワークエラーの確認
    if (networkErrors.length > 0) {
      console.log('⚠️  ネットワークエラーが検出されました:');
      networkErrors.forEach(error => {
        console.log(`   ${error.status} ${error.statusText}: ${error.url}`);
      });
    } else {
      console.log('✅ ネットワークエラーなし');
    }

    // コンソールエラーの確認
    const errorMessages = consoleMessages.filter(msg => 
      msg.includes('error') || msg.includes('Error') || msg.includes('❌')
    );
    
    if (errorMessages.length > 0) {
      console.log('⚠️  コンソールエラーが検出されました:');
      errorMessages.forEach(error => {
        console.log(`   ${error}`);
      });
    } else {
      console.log('✅ コンソールエラーなし');
    }

    // 成功メッセージの確認
    const successMessages = consoleMessages.filter(msg => 
      msg.includes('✅') || msg.includes('CoachAI サービスが利用可能')
    );
    
    if (successMessages.length > 0) {
      console.log('✅ 成功メッセージ:');
      successMessages.forEach(msg => {
        console.log(`   ${msg}`);
      });
    }

    console.log('\n🎉 チャット統合テスト完了');
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    
    // スクリーンショットを撮影
    await page.screenshot({ 
      path: 'test-error-screenshot.png',
      fullPage: true 
    });
    console.log('📸 エラー時のスクリーンショットを保存しました: test-error-screenshot.png');
    
  } finally {
    await browser.close();
  }
}

// テスト実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runChatIntegrationTest().catch(console.error);
}

export { runChatIntegrationTest };