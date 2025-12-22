import { CognitoConfig } from '@/types/auth';

/**
 * アプリケーション設定
 */
export const config = {
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-west-2_tykFYGwK7',
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || 'q1m738bplsn2k6orkq0avs589',
    region: import.meta.env.VITE_COGNITO_REGION || 'us-west-2',
  } as CognitoConfig,
  
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  },
};

/**
 * 設定の検証
 */
export const validateConfig = (): void => {
  console.log('Using Cognito configuration:', {
    userPoolId: config.cognito.userPoolId,
    clientId: config.cognito.clientId,
    region: config.cognito.region,
  });

  const requiredEnvVars = [
    'VITE_COGNITO_USER_POOL_ID',
    'VITE_COGNITO_CLIENT_ID',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !import.meta.env[varName]
  );

  if (missingVars.length > 0) {
    console.warn(
      `Using default Cognito configuration. Missing environment variables: ${missingVars.join(', ')}\n` +
      'Set these variables for production use.'
    );
  }
};