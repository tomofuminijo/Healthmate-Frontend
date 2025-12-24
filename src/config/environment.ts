/**
 * Environment Configuration
 * 環境別設定の管理
 */

// 有効な環境の定義
export const VALID_ENVIRONMENTS = ['dev', 'stage', 'prod'] as const;
export type Environment = typeof VALID_ENVIRONMENTS[number];

// デフォルト環境
export const DEFAULT_ENVIRONMENT: Environment = 'dev';

/**
 * 現在の環境を取得
 */
export function getCurrentEnvironment(): Environment {
  const env = import.meta.env.HEALTHMATE_ENV || DEFAULT_ENVIRONMENT;
  
  if (!VALID_ENVIRONMENTS.includes(env as Environment)) {
    console.warn(`Invalid environment: ${env}, defaulting to ${DEFAULT_ENVIRONMENT}`);
    return DEFAULT_ENVIRONMENT;
  }
  
  return env as Environment;
}

/**
 * 環境設定オブジェクト
 */
export const config = {
  // 環境情報
  environment: getCurrentEnvironment(),
  
  // AWS設定
  aws: {
    region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
  },
  
  // Cognito設定
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    region: import.meta.env.VITE_COGNITO_REGION || 'us-west-2',
  },
  
  // API エンドポイント
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL,
  },
  
  // CoachAI設定
  coachAI: {
    agentArn: import.meta.env.VITE_COACHAI_AGENT_ARN,
  },
  
  // ログ設定
  logging: {
    level: import.meta.env.VITE_LOG_LEVEL || 'INFO',
  },
  
  // 環境判定ヘルパー
  isDevelopment: () => getCurrentEnvironment() === 'dev',
  isStaging: () => getCurrentEnvironment() === 'stage',
  isProduction: () => getCurrentEnvironment() === 'prod',
} as const;

/**
 * 設定の検証
 */
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 必須設定のチェック
  if (!config.cognito.userPoolId) {
    errors.push('VITE_COGNITO_USER_POOL_ID is required');
  }
  
  if (!config.cognito.clientId) {
    errors.push('VITE_COGNITO_CLIENT_ID is required');
  }
  
  if (!config.api.baseUrl) {
    errors.push('VITE_API_BASE_URL is required');
  }
  
  if (!config.coachAI.agentArn) {
    errors.push('VITE_COACHAI_AGENT_ARN is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 設定情報をログ出力（デバッグ用）
 */
export function logConfig(): void {
  if (config.isDevelopment()) {
    console.log('Environment Configuration:', {
      environment: config.environment,
      nodeEnv: config.nodeEnv,
      aws: config.aws,
      cognito: {
        ...config.cognito,
        // セキュリティのため一部をマスク
        userPoolId: config.cognito.userPoolId ? `${config.cognito.userPoolId.slice(0, 10)}...` : 'not set',
        clientId: config.cognito.clientId ? `${config.cognito.clientId.slice(0, 10)}...` : 'not set',
      },
      api: config.api,
      coachAI: {
        agentArn: config.coachAI.agentArn ? `${config.coachAI.agentArn.slice(0, 30)}...` : 'not set',
      },
      logging: config.logging,
    });
  }
}

// 開発環境でのみ設定をログ出力
if (config.isDevelopment()) {
  logConfig();
}