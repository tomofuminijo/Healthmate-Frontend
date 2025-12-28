/**
 * Environment Hook
 * 環境設定を使用するためのReactフック
 */

import { useEffect, useState } from 'react';
import { config, validateConfig, getCurrentEnvironment, type Environment } from '@/config/environment';
import { logger } from '@/lib/logger';

/**
 * 環境設定フック
 */
export function useEnvironment() {
  const [environment] = useState<Environment>(getCurrentEnvironment());
  const [configValidation, setConfigValidation] = useState(validateConfig());

  useEffect(() => {
    // 設定の検証
    const validation = validateConfig();
    setConfigValidation(validation);

    // 開発環境でエラーがある場合は警告を表示
    if (!validation.isValid && config.isDevelopment()) {
      logger.warn('Environment configuration errors:', validation.errors);
    }
  }, []);

  return {
    // 環境情報
    environment,
    isDevelopment: config.isDevelopment(),
    isStaging: config.isStaging(),
    isProduction: config.isProduction(),
    
    // 設定情報
    config,
    
    // 検証結果
    isConfigValid: configValidation.isValid,
    configErrors: configValidation.errors,
    
    // ヘルパー関数
    getApiUrl: (endpoint: string) => `${config.api.baseUrl}${endpoint}`,
  };
}

/**
 * 環境固有の設定フック
 */
export function useEnvironmentConfig() {
  return {
    aws: config.aws,
    cognito: config.cognito,
    api: config.api,
    coachAI: config.coachAI,
    logging: config.logging,
  };
}

/**
 * API エンドポイント構築フック
 */
export function useApiEndpoints() {
  return {
    // ベースURL
    baseUrl: config.api.baseUrl,
    
    // ヘルパー関数
    buildApiUrl: (path: string) => {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${config.api.baseUrl}${cleanPath}`;
    },
  };
}