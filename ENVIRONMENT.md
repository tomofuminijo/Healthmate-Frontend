# 環境別設定ガイド

## 概要

Healthmate-Frontend サービスでは、開発環境（dev）、ステージング環境（stage）、本番環境（prod）の3つの環境をサポートしています。

## 環境変数ファイル

### ファイル構成

```
Healthmate-Frontend/
├── .env.dev      # 開発環境設定
├── .env.stage    # ステージング環境設定
├── .env.prod     # 本番環境設定
├── .env          # ローカル開発用（.env.devベース）
└── .env.example  # テンプレートファイル
```

### 環境変数の説明

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `HEALTHMATE_ENV` | 環境識別子 | `dev`, `stage`, `prod` |
| `VITE_AWS_REGION` | AWS リージョン | `us-west-2` |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | `us-west-2_xxxxxxxxx` |
| `VITE_COGNITO_CLIENT_ID` | Cognito Client ID | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `VITE_API_BASE_URL` | API ベースURL | `https://api-dev.healthmate.example.com` |
| `VITE_MCP_GATEWAY_ENDPOINT` | MCP Gateway エンドポイント | `https://api-dev.healthmate.example.com/mcp` |
| `VITE_AGENTCORE_ENDPOINT` | AgentCore エンドポイント | `https://agent-dev.healthmate.example.com` |
| `VITE_COACHAI_AGENT_ARN` | CoachAI Agent ARN | `arn:aws:bedrock-agentcore:...` |
| `VITE_LOG_LEVEL` | ログレベル | `DEBUG`, `INFO`, `WARNING` |

## 開発コマンド

### 環境別開発サーバー

```bash
# 開発環境で起動
npm run dev:dev

# ステージング環境で起動
npm run dev:stage

# 本番環境で起動
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
```

### 環境別プレビュー

```bash
# 開発環境用プレビュー
npm run preview:dev

# ステージング環境用プレビュー
npm run preview:stage

# 本番環境用プレビュー
npm run preview:prod
```

## 環境設定の使用方法

### TypeScriptでの使用

```typescript
import { config, useEnvironment } from '@/config/environment';

// 設定オブジェクトの直接使用
console.log('Current environment:', config.environment);
console.log('API Base URL:', config.api.baseUrl);

// Reactフックでの使用
function MyComponent() {
  const { environment, isDevelopment, config } = useEnvironment();
  
  return (
    <div>
      <p>Environment: {environment}</p>
      {isDevelopment && <p>Debug mode enabled</p>}
    </div>
  );
}
```

### API エンドポイントの構築

```typescript
import { useApiEndpoints } from '@/hooks/useEnvironment';

function ApiComponent() {
  const { buildApiUrl, buildMcpUrl } = useApiEndpoints();
  
  const userApiUrl = buildApiUrl('/users');
  const mcpToolUrl = buildMcpUrl('getUserData');
  
  // API呼び出し...
}
```

## 環境別設定の詳細

### 開発環境（dev）

- **ログレベル**: DEBUG（詳細なデバッグ情報）
- **エンドポイント**: `-dev` サフィックス付き
- **設定検証**: エラーがあっても警告のみ
- **設定ログ**: コンソールに詳細な設定情報を出力

### ステージング環境（stage）

- **ログレベル**: INFO（一般的な情報）
- **エンドポイント**: `-stage` サフィックス付き
- **設定検証**: エラーがあっても警告のみ
- **設定ログ**: 最小限の情報のみ

### 本番環境（prod）

- **ログレベル**: WARNING（警告以上のみ）
- **エンドポイント**: サフィックスなし
- **設定検証**: エラーがあるとアプリケーション停止
- **設定ログ**: セキュリティ情報はマスク

## トラブルシューティング

### 環境変数が読み込まれない

1. 正しい `.env.{environment}` ファイルが存在するか確認
2. Viteの `--mode` オプションが正しく指定されているか確認
3. 環境変数名が `VITE_` プレフィックスで始まっているか確認

### 設定エラーが表示される

開発環境では設定エラーが画面に表示されます：

```
環境設定エラー
以下の環境変数が設定されていません：
• VITE_COGNITO_USER_POOL_ID is required
• VITE_COGNITO_CLIENT_ID is required
```

必要な環境変数を `.env.{environment}` ファイルに追加してください。

### 本番環境でアプリケーションが起動しない

本番環境では設定エラーがあるとアプリケーションが停止します。
すべての必須環境変数が正しく設定されているか確認してください。

## セキュリティ注意事項

1. **機密情報の管理**: 本番環境の `.env.prod` ファイルには実際の認証情報を含めないでください
2. **Git管理**: `.env.prod` ファイルは `.gitignore` に追加し、バージョン管理から除外してください
3. **CI/CD**: 本番デプロイ時は環境変数を安全な方法で注入してください
4. **ログ出力**: 本番環境では機密情報がログに出力されないよう自動的にマスクされます

## 環境設定の拡張

新しい環境変数を追加する場合：

1. `src/config/environment.ts` の `ImportMetaEnv` インターフェースに型定義を追加
2. `config` オブジェクトに新しい設定項目を追加
3. 必要に応じて `validateConfig()` 関数に検証ロジックを追加
4. 各環境の `.env.{environment}` ファイルに変数を追加