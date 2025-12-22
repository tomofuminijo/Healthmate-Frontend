# Healthmate Frontend

React + Vite + TypeScript技術スタックを使用したモダンなSPAフロントエンドです。

## 技術スタック

- **フレームワーク**: React 18 + Vite 5
- **言語**: TypeScript 5
- **UIライブラリ**: Tailwind CSS + shadcn/ui
- **AI連携**: Vercel AI SDK
- **認証**: AWS Cognito SDK
- **状態管理**: React Context + useReducer
- **ルーティング**: React Router v6
- **テスト**: Vitest + React Testing Library + fast-check

## 開発環境セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn

### インストール

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して適切な値を設定
```

### 開発サーバー

```bash
# 開発サーバーの起動
npm run dev
```

### テスト

```bash
# 単体テスト実行
npm run test

# テストのwatch mode
npm run test:watch

# テストUI
npm run test:ui
```

### ビルド

```bash
# プロダクションビルド
npm run build

# ビルド結果のプレビュー
npm run preview
```

## プロジェクト構造

```
src/
├── components/          # Reactコンポーネント
├── hooks/              # カスタムフック
├── lib/                # ユーティリティ関数
├── types/              # TypeScript型定義
├── test/               # テスト設定
├── App.tsx             # メインアプリケーション
├── main.tsx            # エントリーポイント
└── index.css           # グローバルスタイル
```

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `VITE_COACHAI_ENDPOINT` | CoachAI APIエンドポイント | `http://localhost:8000` |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | - |
| `VITE_COGNITO_CLIENT_ID` | Cognito Client ID | - |
| `VITE_COGNITO_REGION` | AWS Region | `us-west-2` |

## 開発ガイドライン

- TypeScriptの型安全性を活用
- Tailwind CSSでスタイリング
- React Testing Libraryでテスト
- fast-checkでプロパティベーステスト
- ESLintでコード品質管理