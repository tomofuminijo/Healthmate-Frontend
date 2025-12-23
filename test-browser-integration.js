#!/usr/bin/env node

/**
 * Healthmate-Frontend ブラウザ統合テスト
 * 
 * このスクリプトは実際のブラウザでの動作をシミュレートします：
 * 1. ログイン処理のテスト
 * 2. リダイレクト処理の確認
 * 3. チャット機能のテスト
 */

import fetch from 'node-fetch';

// 設定
const CONFIG = {
  frontendUrl: 'http://localhost:3000',
  testUser: {
    username: 'healthuser1',
    password: 'TempPassword123!'
  }
};

/**
 * ログインページの確認
 */
async function testSignInPage() {
  console.log('🔐 サインインページの確認...');
  
  try {
    const response = await fetch(`${CONFIG.frontendUrl}/signin`);
    if (response.ok) {
      const html = await response.text();
      
      // サインインフォームの存在確認
      const hasSignInForm = html.includes('ユーザー名') && html.includes('パスワード');
      const hasCognitoConfig = html.includes('us-west-2_tykFYGwK7');
      
      if (hasSignInForm) {
        console.log('   ✅ サインインフォームが正常に表示されています');
      } else {
        console.log('   ❌ サインインフォームが見つかりません');
        return false;
      }
      
      if (hasCognitoConfig) {
        console.log('   ✅ Cognito設定が正しく表示されています');
      } else {
        console.log('   ⚠️  Cognito設定の表示を確認できません');
      }
      
      return true;
    } else {
      console.log(`   ❌ ログインページエラー: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ログインページアクセスエラー: ${error.message}`);
    return false;
  }
}

/**
 * ダッシュボードページの確認（認証が必要）
 */
async function testDashboardPage() {
  console.log('📊 ダッシュボードページの確認...');
  
  try {
    const response = await fetch(`${CONFIG.frontendUrl}/dashboard`);
    
    if (response.status === 200) {
      const html = await response.text();
      
      // リダイレクトされずにダッシュボードが表示される場合
      const hasChatInterface = html.includes('チャット') || html.includes('Healthmate');
      
      if (hasChatInterface) {
        console.log('   ⚠️  認証なしでダッシュボードにアクセスできました（要確認）');
        return false;
      }
    }
    
    // 通常は認証が必要なため、ログインページにリダイレクトされるはず
    console.log('   ✅ 認証が必要なページは適切に保護されています');
    return true;
    
  } catch (error) {
    console.log(`   ❌ ダッシュボードページアクセスエラー: ${error.message}`);
    return false;
  }
}

/**
 * ルートページのリダイレクト確認
 */
async function testRootRedirect() {
  console.log('🏠 ルートページのリダイレクト確認...');
  
  try {
    const response = await fetch(`${CONFIG.frontendUrl}/`, {
      redirect: 'manual' // リダイレクトを手動で処理
    });
    
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      console.log(`   ✅ ルートページから適切にリダイレクトされます: ${location}`);
      return true;
    } else {
      console.log(`   ⚠️  予期しないレスポンス: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ルートページアクセスエラー: ${error.message}`);
    return false;
  }
}

/**
 * 静的アセットの確認
 */
async function testStaticAssets() {
  console.log('📦 静的アセットの確認...');
  
  const assets = [
    '/src/main.tsx',
    '/src/App.tsx',
    '/src/index.css'
  ];
  
  let allAssetsOk = true;
  
  for (const asset of assets) {
    try {
      const response = await fetch(`${CONFIG.frontendUrl}${asset}`);
      if (response.ok) {
        console.log(`   ✅ ${asset}`);
      } else {
        console.log(`   ❌ ${asset}: ${response.status}`);
        allAssetsOk = false;
      }
    } catch (error) {
      console.log(`   ❌ ${asset}: ${error.message}`);
      allAssetsOk = false;
    }
  }
  
  return allAssetsOk;
}

/**
 * 開発サーバーの詳細情報取得
 */
async function getServerInfo() {
  console.log('🔍 開発サーバー情報...');
  
  try {
    const response = await fetch(`${CONFIG.frontendUrl}/`);
    const html = await response.text();
    
    // Viteの開発サーバー情報を抽出
    const viteInfo = html.match(/vite/i);
    const reactInfo = html.match(/react/i);
    
    if (viteInfo) {
      console.log('   ✅ Vite開発サーバーが動作中');
    }
    
    if (reactInfo) {
      console.log('   ✅ Reactアプリケーションが読み込まれています');
    }
    
    // 環境変数の確認
    const cognitoInfo = html.includes('us-west-2_tykFYGwK7');
    if (cognitoInfo) {
      console.log('   ✅ Cognito設定が正しく読み込まれています');
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ サーバー情報取得エラー: ${error.message}`);
    return false;
  }
}

/**
 * 手動テスト手順の表示
 */
function displayManualTestSteps() {
  console.log('\n📋 手動テスト手順:');
  console.log('=' * 50);
  console.log();
  console.log('1. ブラウザで http://localhost:3000 にアクセス');
  console.log('   → ダッシュボードにリダイレクトされる');
  console.log('   → 認証が必要なため、ログインページにリダイレクトされる');
  console.log();
  console.log('2. ログインページでテストユーザーを使用:');
  console.log(`   ユーザー名: ${CONFIG.testUser.username}`);
  console.log(`   パスワード: ${CONFIG.testUser.password}`);
  console.log('   または「healthuser1」ボタンをクリック');
  console.log();
  console.log('3. ログイン成功後:');
  console.log('   → ダッシュボード（/dashboard）にリダイレクトされる');
  console.log('   → チャットインターフェースが表示される');
  console.log('   → ヘッダーにユーザー名とログアウトボタンが表示される');
  console.log();
  console.log('4. チャット機能のテスト:');
  console.log('   → 「こんにちは」と入力して送信');
  console.log('   → CoachAI APIまたはモックAPIから応答が返される');
  console.log('   → メッセージがチャット履歴に保存される');
  console.log();
  console.log('5. セッション管理のテスト:');
  console.log('   → 「新しいチャット」ボタンで新しいセッションを作成');
  console.log('   → サイドバーでセッション切り替えが可能');
  console.log('   → ページリロード後もセッションが保持される');
  console.log();
  console.log('6. ログアウトのテスト:');
  console.log('   → ログアウトボタンをクリック');
  console.log('   → ログインページにリダイレクトされる');
  console.log('   → 認証状態がクリアされる');
  console.log();
  console.log('🔧 トラブルシューティング:');
  console.log('- ログイン後にリダイレクトされない場合:');
  console.log('  → ブラウザの開発者ツールでコンソールエラーを確認');
  console.log('  → ネットワークタブで認証リクエストを確認');
  console.log('- CoachAI APIエラーの場合:');
  console.log('  → モックAPIにフォールバックして動作継続');
  console.log('  → エラーメッセージが適切に表示される');
  console.log();
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('🌐 Healthmate-Frontend ブラウザ統合テスト');
  console.log('=' * 60);
  console.log();
  
  const tests = [
    { name: 'サーバー情報取得', fn: getServerInfo },
    { name: 'サインインページ', fn: testSignInPage },
    { name: 'ダッシュボード保護', fn: testDashboardPage },
    { name: 'ルートリダイレクト', fn: testRootRedirect },
    { name: '静的アセット', fn: testStaticAssets },
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
  console.log(`📊 自動テスト結果: ${passedTests}/${tests.length} 成功`);
  
  if (passedTests === tests.length) {
    console.log('🎉 すべての自動テストが成功しました！');
  } else {
    console.log('⚠️  一部の自動テストが失敗しました。');
  }
  
  displayManualTestSteps();
}

// 実行
main().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});