#!/usr/bin/env node

/**
 * 手動チャットテスト用スクリプト
 * ブラウザを開いて手動でテストできるようにします
 */

import { chromium } from 'playwright';

async function openTestBrowser() {
  console.log('🚀 手動チャットテスト用ブラウザを起動します');
  console.log('📋 テスト手順:');
  console.log('  1. ログインページでhealthuser1 / HealthUser123! でログイン');
  console.log('  2. ダッシュボードのチャット画面で「こんにちは」と送信');
  console.log('  3. 開発者ツールのコンソールでエラーを確認');
  console.log('  4. AI応答が表示されるか確認');
  console.log('');

  const browser = await chromium.launch({ 
    headless: false,
    devtools: true, // 開発者ツールを自動で開く
    slowMo: 500
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  // ログインページを開く
  await page.goto('http://localhost:3000/login');
  
  console.log('✅ ブラウザが開きました: http://localhost:3000/login');
  console.log('⌨️  手動でテストを実行してください');
  console.log('🔍 開発者ツールのコンソールタブでログを確認してください');
  console.log('');
  console.log('💡 テスト完了後、Ctrl+C でこのスクリプトを終了してください');

  // ブラウザが閉じられるまで待機
  try {
    await page.waitForEvent('close', { timeout: 0 });
  } catch (error) {
    // タイムアウトは無視（手動テストのため）
  }

  await browser.close();
}

// スクリプト実行
openTestBrowser().catch(console.error);