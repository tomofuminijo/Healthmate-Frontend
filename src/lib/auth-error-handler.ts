/**
 * 認証エラーハンドリングユーティリティ
 * 本番環境に適したエラーメッセージとエラー分類を提供
 */

export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  NEW_PASSWORD_REQUIRED = 'NEW_PASSWORD_REQUIRED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AuthError {
  type: AuthErrorType;
  message: string;
  userFriendlyMessage: string;
  retryable: boolean;
}

// 本番用エラーメッセージ定数
const ERROR_MESSAGES = {
  [AuthErrorType.INVALID_CREDENTIALS]: 'ユーザー名またはパスワードが正しくありません',
  [AuthErrorType.NETWORK_ERROR]: 'ネットワークエラーが発生しました。しばらく後でお試しください',
  [AuthErrorType.VALIDATION_ERROR]: 'ユーザー名とパスワードを入力してください',
  [AuthErrorType.TOKEN_EXPIRED]: 'セッションが期限切れです。再度サインインしてください',
  [AuthErrorType.USER_NOT_FOUND]: 'ユーザー名またはパスワードが正しくありません',
  [AuthErrorType.ACCOUNT_LOCKED]: 'アカウントがロックされています。しばらく後でお試しください',
  [AuthErrorType.TOO_MANY_ATTEMPTS]: 'サインイン試行回数が上限に達しました。しばらく後でお試しください',
  [AuthErrorType.NEW_PASSWORD_REQUIRED]: '初回ログインのため、新しいパスワードを設定してください',
  [AuthErrorType.UNKNOWN_ERROR]: 'サインインに失敗しました。しばらく後でお試しください'
} as const;

/**
 * AWS Amplify/Cognitoエラーを本番用エラーに変換
 */
export function classifyAuthError(error: unknown): AuthError {
  if (!error) {
    return createAuthError(AuthErrorType.UNKNOWN_ERROR, 'Unknown error occurred');
  }

  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const errorName = error instanceof Error ? error.name : '';

  // ネットワークエラーの検出
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection') ||
    errorName === 'NetworkError'
  ) {
    return createAuthError(AuthErrorType.NETWORK_ERROR, errorMessage, true);
  }

  // 認証情報エラーの検出
  if (
    errorMessage.includes('incorrect') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('notauthorized') ||
    errorMessage.includes('unauthorized') ||
    errorName === 'NotAuthorizedException'
  ) {
    return createAuthError(AuthErrorType.INVALID_CREDENTIALS, errorMessage);
  }

  // ユーザー不存在エラーの検出
  if (
    errorMessage.includes('user does not exist') ||
    errorMessage.includes('usernotfound') ||
    errorName === 'UserNotFoundException'
  ) {
    return createAuthError(AuthErrorType.USER_NOT_FOUND, errorMessage);
  }

  // アカウントロックエラーの検出
  if (
    errorMessage.includes('locked') ||
    errorMessage.includes('disabled') ||
    errorName === 'UserNotConfirmedException'
  ) {
    return createAuthError(AuthErrorType.ACCOUNT_LOCKED, errorMessage);
  }

  // 試行回数制限エラーの検出
  if (
    errorMessage.includes('too many') ||
    errorMessage.includes('limit exceeded') ||
    errorMessage.includes('throttled') ||
    errorName === 'TooManyRequestsException'
  ) {
    return createAuthError(AuthErrorType.TOO_MANY_ATTEMPTS, errorMessage, true);
  }

  // トークン期限切れエラーの検出
  if (
    errorMessage.includes('token') && errorMessage.includes('expired') ||
    errorMessage.includes('session') && errorMessage.includes('expired') ||
    errorName === 'TokenExpiredException'
  ) {
    return createAuthError(AuthErrorType.TOKEN_EXPIRED, errorMessage);
  }

  // 強制パスワード変更エラーの検出
  if (
    errorMessage.includes('new_password_required') ||
    errorMessage.includes('newpasswordrequired') ||
    errorName === 'NewPasswordRequiredException'
  ) {
    return createAuthError(AuthErrorType.NEW_PASSWORD_REQUIRED, errorMessage);
  }

  // その他のエラー
  return createAuthError(AuthErrorType.UNKNOWN_ERROR, errorMessage);
}

/**
 * AuthErrorオブジェクトを作成
 */
function createAuthError(
  type: AuthErrorType, 
  originalMessage: string, 
  retryable: boolean = false
): AuthError {
  return {
    type,
    message: originalMessage,
    userFriendlyMessage: ERROR_MESSAGES[type],
    retryable
  };
}

/**
 * 入力バリデーション
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateSignInCredentials(username: string, password: string): ValidationResult {
  const errors: string[] = [];

  // ユーザー名のバリデーション
  if (!username || !username.trim()) {
    errors.push('ユーザー名を入力してください');
  } else if (username.trim().length < 3) {
    errors.push('ユーザー名は3文字以上で入力してください');
  } else if (username.trim().length > 50) {
    errors.push('ユーザー名は50文字以下で入力してください');
  }

  // パスワードのバリデーション
  if (!password || !password.trim()) {
    errors.push('パスワードを入力してください');
  } else if (password.length < 8) {
    errors.push('パスワードは8文字以上で入力してください');
  } else if (password.length > 128) {
    errors.push('パスワードは128文字以下で入力してください');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 新しいパスワードのバリデーション
 */
export function validateNewPassword(newPassword: string, confirmPassword: string): ValidationResult {
  const errors: string[] = [];

  // 新しいパスワードのバリデーション
  if (!newPassword || !newPassword.trim()) {
    errors.push('新しいパスワードを入力してください');
  } else {
    if (newPassword.length < 8) {
      errors.push('パスワードは8文字以上で入力してください');
    }
    if (newPassword.length > 128) {
      errors.push('パスワードは128文字以下で入力してください');
    }
    if (!/[A-Z]/.test(newPassword)) {
      errors.push('パスワードには大文字を含めてください');
    }
    if (!/[a-z]/.test(newPassword)) {
      errors.push('パスワードには小文字を含めてください');
    }
    if (!/[0-9]/.test(newPassword)) {
      errors.push('パスワードには数字を含めてください');
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      errors.push('パスワードには記号を含めてください');
    }
  }

  // パスワード確認のバリデーション
  if (!confirmPassword || !confirmPassword.trim()) {
    errors.push('パスワード確認を入力してください');
  } else if (newPassword !== confirmPassword) {
    errors.push('パスワードが一致しません');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
export function isRetryableError(error: AuthError): boolean {
  return error.retryable || error.type === AuthErrorType.NETWORK_ERROR;
}

/**
 * エラーログ用の安全なエラー情報を作成（機密情報を除外）
 */
export function createSafeErrorLog(error: AuthError, context?: string): object {
  return {
    type: error.type,
    retryable: error.retryable,
    context: context || 'authentication',
    timestamp: new Date().toISOString(),
    // 機密情報は含めない
  };
}