/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 環境変数を読み込み
  const env = loadEnv(mode, process.cwd(), '')
  
  // アプリバージョンを生成（ビルド時のタイムスタンプ）
  const appVersion = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '-')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // 環境変数の設定
    define: {
      // HEALTHMATE_ENVをVite環境変数として利用可能にする
      'import.meta.env.HEALTHMATE_ENV': JSON.stringify(env.HEALTHMATE_ENV || mode),
      // アプリバージョンを埋め込み（キャッシュ管理用）
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // React関連を分離
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // UI関連を分離
            'ui-vendor': ['@radix-ui/react-slot', 'class-variance-authority', 'clsx', 'tailwind-merge'],
            // 認証関連を分離
            'auth-vendor': ['aws-amplify']
          }
        }
      },
      // チャンクサイズ警告の閾値を調整
      chunkSizeWarningLimit: 600
    },
    server: {
      port: 3000,
      host: '0.0.0.0', // 外部からのアクセスを許可
      // CoachAI APIは直接AgentCore Runtimeエンドポイントに接続するため、プロキシは不要
    },
    test: {
      globals: true,
      environment: 'node',
      setupFiles: ['./src/test/setup.ts'],
    }
  }
})