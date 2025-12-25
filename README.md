# Healthmate Frontend

React + Vite + TypeScript技術スタックを使用したモダンなSPAフロントエンドです。

## 🌍 環境設定

### 対応環境

Healthmate-Frontend は以下の3つの環境をサポートします：

- **dev**: 開発環境（デフォルト）
- **stage**: ステージング環境
- **prod**: 本番環境

### 環境変数ファイル

各環境に対応した環境変数ファイルを使用します：

| ファイル | 環境 | 説明 |
|---------|------|------|
| `.env.dev` | 開発環境 | 開発用API エンドポイントとCognito設定 |
| `.env.stage` | ステージング環境 | ステージング用設定 |
| `.env.prod` | 本番環境 | 本番用設定 |
| `.env.example` | テンプレート | 環境変数のテンプレート |

### 環境別設定例

#### .env.dev
```bash
HEALTHMATE_ENV=dev
VITE_COACHAI_ENDPOINT=https://agent-dev.healthmate.example.com
VITE_MCP_GATEWAY_ENDPOINT=https://api-dev.healthmate.example.com
VITE_COGNITO_USER_POOL_ID=us-west-2_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=dev-client-id
VITE_COGNITO_REGION=us-west-2
```

#### .env.stage
```bash
HEALTHMATE_ENV=stage
VITE_COACHAI_ENDPOINT=https://agent-stage.healthmate.example.com
VITE_MCP_GATEWAY_ENDPOINT=https://api-stage.healthmate.example.com
VITE_COGNITO_USER_POOL_ID=us-west-2_yyyyyyyyy
VITE_COGNITO_CLIENT_ID=stage-client-id
VITE_COGNITO_REGION=us-west-2
```

#### .env.prod
```bash
HEALTHMATE_ENV=prod
VITE_COACHAI_ENDPOINT=https://agent.healthmate.example.com
VITE_MCP_GATEWAY_ENDPOINT=https://api.healthmate.example.com
VITE_COGNITO_USER_POOL_ID=us-west-2_zzzzzzzzz
VITE_COGNITO_CLIENT_ID=prod-client-id
VITE_COGNITO_REGION=us-west-2
```

### テスト

```bash
# 単体テスト実行
npm run test

# テストのwatch mode
npm run test:watch

# テストUI
npm run test:ui

# 環境別テスト
npm run test:dev
npm run test:stage
npm run test:prod
```

## 技術スタック

- **フレームワーク**: React 18 + Vite 5
- **言語**: TypeScript 5
- **UIライブラリ**: Tailwind CSS + shadcn/ui
- **AI連携**: Vercel AI SDK
- **認証**: AWS Cognito SDK
- **状態管理**: React Context + useReducer
- **ルーティング**: React Router v6
- **テスト**: Vitest + React Testing Library + fast-check
- **環境管理**: 環境別設定ファイル（.env.dev/.env.stage/.env.prod）

## 開発環境セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn

### インストール

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env.dev
cp .env.example .env.stage  
cp .env.example .env.prod

# 各環境ファイルを編集して適切な値を設定
# .env.dev, .env.stage, .env.prod を編集
```

### 環境別開発サーバー

```bash
# 開発環境（デフォルト）
npm run dev

# ステージング環境
npm run dev:stage

# 本番環境設定での開発
npm run dev:prod
```

### 環境別ビルド

```bash
# 開発環境用ビルド
npm run build:dev

# ステージング環境用ビルド
npm run build:stage

# 本番環境用ビルド
npm run build:prod

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

| 変数名 | 説明 | デフォルト値 | 環境別設定 |
|--------|------|-------------|-----------|
| `HEALTHMATE_ENV` | デプロイ環境 | `dev` | dev/stage/prod |
| `VITE_COACHAI_ENDPOINT` | CoachAI APIエンドポイント | 環境により異なる | 環境別URL |
| `VITE_MCP_GATEWAY_ENDPOINT` | MCP Gateway エンドポイント | 環境により異なる | 環境別URL |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | - | 環境別Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito Client ID | - | 環境別Client ID |
| `VITE_COGNITO_REGION` | AWS Region | `us-west-2` | 共通 |

### 環境別エンドポイント例

| 環境 | CoachAI エンドポイント | MCP Gateway エンドポイント |
|------|----------------------|---------------------------|
| dev | `https://agent-dev.healthmate.example.com` | `https://api-dev.healthmate.example.com` |
| stage | `https://agent-stage.healthmate.example.com` | `https://api-stage.healthmate.example.com` |
| prod | `https://agent.healthmate.example.com` | `https://api.healthmate.example.com` |

## 開発ガイドライン

- TypeScriptの型安全性を活用
- Tailwind CSSでスタイリング
- React Testing Libraryでテスト
- fast-checkでプロパティベーステスト
- ESLintでコード品質管理
- 環境別設定ファイルによる設定管理
- 環境に応じたログレベル制御（dev: verbose, stage/prod: minimal）

## 環境設定の確認

```bash
# 現在の環境設定を確認
npm run env:check

# 環境別設定ファイルの検証
npm run env:validate

# 環境変数の一覧表示
npm run env:list
```

## デプロイメント

### 環境別デプロイ

```bash
# 開発環境
npm run deploy:dev

# ステージング環境
npm run deploy:stage

# 本番環境
npm run deploy:prod
```

### 静的ホスティング

各環境に応じたS3 + CloudFrontまたはVercelでのデプロイをサポート：

- **dev**: 開発用ドメイン（例: dev.healthmate.example.com）
- **stage**: ステージング用ドメイン（例: stage.healthmate.example.com）
- **prod**: 本番用ドメイン（例: healthmate.example.com）