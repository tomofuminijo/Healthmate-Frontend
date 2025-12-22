/**
 * Error Handler - 統一エラーハンドリングシステム
 */

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  timestamp: Date;
  retryable: boolean;
}

/**
 * エラー分類とユーザーフレンドリーなメッセージ生成
 */
export class ErrorHandler {
  /**
   * エラーを分類してAppError形式に変換
   */
  static classify(error: unknown): AppError {
    const timestamp = new Date();

    // ネットワークエラー
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: 'インターネット接続を確認してください',
        details: error.message,
        timestamp,
        retryable: true,
      };
    }

    // HTTPエラー
    if (error instanceof Response) {
      return this.classifyHttpError(error, timestamp);
    }

    // Fetch APIエラー
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          type: ErrorType.TIMEOUT_ERROR,
          message: 'リクエストがタイムアウトしました',
          details: error.message,
          timestamp,
          retryable: true,
        };
      }

      if (error.message.includes('Failed to fetch')) {
        return {
          type: ErrorType.SERVICE_UNAVAILABLE,
          message: 'CoachAI サービスに接続できません',
          details: error.message,
          timestamp,
          retryable: true,
        };
      }
    }

    // 不明なエラー
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: '予期しないエラーが発生しました',
      details: error instanceof Error ? error.message : String(error),
      timestamp,
      retryable: false,
    };
  }

  /**
   * HTTPエラーを分類
   */
  private static classifyHttpError(response: Response, timestamp: Date): AppError {
    switch (response.status) {
      case 401:
        return {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: '認証が必要です。再度ログインしてください',
          details: `HTTP ${response.status}: ${response.statusText}`,
          timestamp,
          retryable: false,
        };

      case 403:
        return {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: 'アクセス権限がありません',
          details: `HTTP ${response.status}: ${response.statusText}`,
          timestamp,
          retryable: false,
        };

      case 404:
        return {
          type: ErrorType.API_ERROR,
          message: 'リクエストされたリソースが見つかりません',
          details: `HTTP ${response.status}: ${response.statusText}`,
          timestamp,
          retryable: false,
        };

      case 429:
        return {
          type: ErrorType.API_ERROR,
          message: 'リクエストが多すぎます。しばらく待ってから再試行してください',
          details: `HTTP ${response.status}: ${response.statusText}`,
          timestamp,
          retryable: true,
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: ErrorType.SERVICE_UNAVAILABLE,
          message: 'サーバーで問題が発生しています。しばらく待ってから再試行してください',
          details: `HTTP ${response.status}: ${response.statusText}`,
          timestamp,
          retryable: true,
        };

      default:
        return {
          type: ErrorType.API_ERROR,
          message: 'サーバーエラーが発生しました',
          details: `HTTP ${response.status}: ${response.statusText}`,
          timestamp,
          retryable: response.status >= 500,
        };
    }
  }

  /**
   * エラーの重要度を判定
   */
  static getSeverity(error: AppError): 'low' | 'medium' | 'high' | 'critical' {
    switch (error.type) {
      case ErrorType.AUTHENTICATION_ERROR:
        return 'critical';
      case ErrorType.SERVICE_UNAVAILABLE:
        return 'high';
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
        return 'medium';
      case ErrorType.API_ERROR:
        return 'medium';
      case ErrorType.UNKNOWN_ERROR:
        return 'high';
      default:
        return 'low';
    }
  }

  /**
   * リトライ推奨時間を取得（ミリ秒）
   */
  static getRetryDelay(error: AppError, attemptCount: number): number {
    if (!error.retryable) {
      return 0;
    }

    const baseDelay = 1000; // 1秒
    const maxDelay = 30000; // 30秒

    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
        // 指数バックオフ
        return Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);

      case ErrorType.SERVICE_UNAVAILABLE:
        // より長い遅延
        return Math.min(baseDelay * 5 * Math.pow(2, attemptCount), maxDelay);

      case ErrorType.API_ERROR:
        // 固定遅延
        return baseDelay * 3;

      default:
        return baseDelay;
    }
  }

  /**
   * ユーザー向けアクションメッセージを生成
   */
  static getActionMessage(error: AppError): string {
    if (!error.retryable) {
      switch (error.type) {
        case ErrorType.AUTHENTICATION_ERROR:
          return 'ログイン画面に移動してください';
        default:
          return 'サポートにお問い合わせください';
      }
    }

    return '再試行ボタンをクリックしてください';
  }
}

/**
 * リトライ機能付きのfetch関数
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> {
  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // タイムアウト設定
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = ErrorHandler.classify(response);
        
        // リトライ不可能なエラーは即座に投げる
        if (!error.retryable || attempt === maxRetries) {
          throw error;
        }

        lastError = error;
        const delay = ErrorHandler.getRetryDelay(error, attempt);
        console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        continue;
      }

      return response;
    } catch (error) {
      const appError = ErrorHandler.classify(error);
      
      // リトライ不可能なエラーは即座に投げる
      if (!appError.retryable || attempt === maxRetries) {
        throw appError;
      }

      lastError = appError;
      const delay = ErrorHandler.getRetryDelay(appError, attempt);
      console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, appError.message);
      
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 最後のエラーを投げる
  throw lastError || ErrorHandler.classify(new Error('Max retries exceeded'));
}

/**
 * サービスヘルスチェック
 */
export async function checkServiceHealth(): Promise<{
  available: boolean;
  latency?: number;
  error?: AppError;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        available: true,
        latency,
      };
    } else {
      return {
        available: false,
        latency,
        error: ErrorHandler.classify(response),
      };
    }
  } catch (error) {
    return {
      available: false,
      latency: Date.now() - startTime,
      error: ErrorHandler.classify(error),
    };
  }
}