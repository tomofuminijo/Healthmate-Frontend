# Healthmate Frontend

React + Vite + TypeScript技術スタックを使用したモダンなSPAフロントエンドです。

## 🌍 環境設定

### 対応環境

Healthmate-Frontend は以下の3つの環境をサポートします：

- **dev**: 開発環境（デフォルト）
- **stage**: ステージング環境
- **prod**: 本番環境

### 🔧 動的環境ファイル生成

**重要**: 環境変数ファイル（.env.dev/.env.stage/.env.prod）は、デプロイ時にCloudFormationから**自動生成**されます。

#### 自動生成される環境変数

| 変数名 | 取得元 | 説明 |
|--------|--------|------|
| `VITE_COGNITO_USER_POOL_ID` | Healthmate-CoreStack-{env} | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Healthmate-CoreStack-{env} | Cognito Client ID |
| `VITE_COACHAI_AGENT_ARN` | bedrock-agentcore-control API | CoachAI Agent ARN |
| `VITE_AWS_REGION` | 設定値 | AWS Region (us-west-2) |
| `VITE_LOG_LEVEL` | 環境別設定 | ログレベル (dev: DEBUG, others: INFO) |

#### 生成プロセス

```bash
# デプロイ実行時に自動実行される
./deploy.sh dev
  ↓
1. CloudFormationからCognito情報を取得
2. bedrock-agentcore-control APIからCoachAI ARNを取得  
3. .env.dev ファイルを自動生成
4. フロントエンドをビルド・デプロイ
```

#### 手動生成（デバッグ用）

```bash
cd scripts
source .venv/bin/activate
python generate_env.py dev
```

### 環境変数テンプレート

参考用のテンプレートファイル：

#### .env.example
```bash
# Environment Configuration Template
HEALTHMATE_ENV=dev
VITE_AWS_REGION=us-west-2
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
VITE_COGNITO_REGION=us-west-2
VITE_API_BASE_URL=http://localhost:3000
VITE_COACHAI_AGENT_ARN=
VITE_LOG_LEVEL=DEBUG
```
VITE_COACHAI_AGENT_ARN=arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/healthmate_coach_ai
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

## CoachAI 連携

### API 通信仕様

Healthmate-CoachAI サービスとの通信では、シンプルなフラット構造のペイロードを使用します：

#### ペイロード構造
```json
{
  "prompt": "ユーザーからのメッセージ",
  "timezone": "Asia/Tokyo",
  "language": "ja"
}
```

#### 認証・セッションヘッダー
```http
Authorization: Bearer {cognito_access_token}
X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: {session_id}
Content-Type: application/json
```

#### 重要な変更点
- **フラット構造**: sessionState/sessionAttributes の階層構造を廃止
- **ヘッダーベース**: session_id はペイロードではなくヘッダーで送信
- **シンプル化**: 必要最小限のフィールドのみ使用

### 実装例

```typescript
// src/api/chat.ts での実装
const payload = {
  prompt: request.prompt,
  timezone: request.timezone || 'Asia/Tokyo',
  language: request.language || 'ja'
};

const headers = {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json',
  'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': request.sessionId,
};
```

## 技術スタック

- **フレームワーク**: React 18 + Vite 5
- **言語**: TypeScript 5
- **UIライブラリ**: Tailwind CSS + shadcn/ui
- **AI連携**: CoachAI AgentCore Runtime (フラット構造ペイロード)
- **認証**: AWS Cognito SDK (JWT Access Token)
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
| `VITE_COACHAI_AGENT_ARN` | CoachAI Agent ARN | 環境により異なる | 環境別ARN |
| `VITE_MCP_GATEWAY_ENDPOINT` | MCP Gateway エンドポイント | 環境により異なる | 環境別URL |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | - | 環境別Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito Client ID | - | 環境別Client ID |
| `VITE_COGNITO_REGION` | AWS Region | `us-west-2` | 共通 |

### 環境別エンドポイント例

| 環境 | CoachAI Agent ARN | MCP Gateway エンドポイント |
|------|-------------------|---------------------------|
| dev | `arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/healthmate_coach_ai-dev` | `https://api-dev.healthmate.example.com` |
| stage | `arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/healthmate_coach_ai-stage` | `https://api-stage.healthmate.example.com` |
| prod | `arn:aws:bedrock-agentcore:us-west-2:123456789012:agent/healthmate_coach_ai-prod` | `https://api-prod.healthmate.example.com` |

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