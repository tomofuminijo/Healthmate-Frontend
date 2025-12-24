/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
    https: false, // HTTPSが必要な場合は true に変更
    // CoachAI APIは直接AgentCore Runtimeエンドポイントに接続するため、プロキシは不要
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  }
})