/**
 * Environment Provider
 * 環境設定の初期化とエラーハンドリング
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { config, validateConfig, type Environment } from '@/config/environment';

interface EnvironmentContextType {
  environment: Environment;
  isConfigValid: boolean;
  configErrors: string[];
  isLoading: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

interface EnvironmentProviderProps {
  children: React.ReactNode;
}

export function EnvironmentProvider({ children }: EnvironmentProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [configValidation, setConfigValidation] = useState(validateConfig());

  useEffect(() => {
    // 環境設定の初期化
    const initializeEnvironment = async () => {
      try {
        // 設定の検証
        const validation = validateConfig();
        setConfigValidation(validation);

        // 開発環境での設定ログ出力
        if (config.isDevelopment()) {
          console.log('Environment initialized:', {
            environment: config.environment,
            isValid: validation.isValid,
            errors: validation.errors,
          });
        }

        // 設定エラーがある場合の処理
        if (!validation.isValid) {
          console.error('Environment configuration errors:', validation.errors);
          
          // 本番環境では致命的エラーとして扱う
          if (config.isProduction()) {
            throw new Error(`Invalid environment configuration: ${validation.errors.join(', ')}`);
          }
        }
      } catch (error) {
        console.error('Failed to initialize environment:', error);
        
        // 本番環境では再スローして、アプリケーションを停止
        if (config.isProduction()) {
          throw error;
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeEnvironment();
  }, []);

  const contextValue: EnvironmentContextType = {
    environment: config.environment,
    isConfigValid: configValidation.isValid,
    configErrors: configValidation.errors,
    isLoading,
  };

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">環境設定を初期化中...</p>
        </div>
      </div>
    );
  }

  // 設定エラーがある場合の表示（開発環境のみ）
  if (!configValidation.isValid && config.isDevelopment()) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center mb-4">
            <div className="bg-red-100 rounded-full p-2 mr-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-red-800">環境設定エラー</h2>
          </div>
          <div className="mb-4">
            <p className="text-red-700 mb-2">以下の環境変数が設定されていません：</p>
            <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
              {configValidation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
          <div className="text-sm text-gray-600">
            <p>適切な .env ファイルが読み込まれているか確認してください。</p>
            <p className="mt-1">現在の環境: <span className="font-mono bg-gray-100 px-1 rounded">{config.environment}</span></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EnvironmentContext.Provider value={contextValue}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironmentContext() {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
}