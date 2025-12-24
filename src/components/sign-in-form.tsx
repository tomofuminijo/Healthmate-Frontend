import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { BrandHeader } from '@/components/brand-header';
import { NewPasswordForm } from '@/components/new-password-form';
import { 
  classifyAuthError, 
  validateSignInCredentials, 
  AuthErrorType,
  type AuthError
} from '@/lib/auth-error-handler';

export const SignInForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthError | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const { signIn, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 認証状態が変更されたときのリダイレクト処理
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  // エラーメッセージをクリアする（ユーザーが入力を開始したとき）
  const clearErrors = useCallback(() => {
    if (error) {
      setError(null);
    }
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  }, [error, validationErrors.length]);

  // リアルタイムバリデーション（デバウンス処理付き）
  const validateInput = useCallback((usernameValue: string, passwordValue: string) => {
    const validation = validateSignInCredentials(usernameValue, passwordValue);
    setValidationErrors(validation.errors);
    return validation;
  }, []);

  // デバウンス処理付きバリデーション（改善版）
  const debouncedValidation = useMemo(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const debouncedFn = (usernameValue: string, passwordValue: string) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        if (usernameValue.trim() && passwordValue.trim()) {
          validateInput(usernameValue, passwordValue);
        }
        timeoutId = null;
      }, 300);
    };

    // クリーンアップ関数を追加
    (debouncedFn as any).cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return debouncedFn as typeof debouncedFn & { cancel: () => void };
  }, [validateInput]);

  // デバウンスのクリーンアップ
  useEffect(() => {
    return () => {
      // コンポーネントアンマウント時にタイマーをクリア
      debouncedValidation.cancel();
    };
  }, [debouncedValidation]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);
    setIsSubmitting(true);

    try {
      // 入力バリデーション
      const validation = validateSignInCredentials(username, password);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        return;
      }

      // サインイン実行
      await signIn(username.trim(), password);
      // リダイレクトはuseEffectで処理される
    } catch (error) {
      console.error('Sign in error:', error);
      
      // エラーを分類して適切なメッセージを表示
      const authError = classifyAuthError(error);
      
      // 強制パスワード変更が必要な場合
      if (authError.type === AuthErrorType.NEW_PASSWORD_REQUIRED) {
        setShowNewPasswordForm(true);
        return;
      }
      
      setError(authError);
      
      // 安全なエラーログを出力（機密情報を除外）
      console.error('Authentication failed:', {
        type: authError.type,
        retryable: authError.retryable,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [username, password, signIn, validateSignInCredentials]);

  // ユーザー名変更ハンドラー（最適化）
  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    clearErrors();
    
    // デバウンス処理付きバリデーション
    if (value.trim() && password) {
      debouncedValidation(value, password);
    }
  }, [password, clearErrors, debouncedValidation]);

  // パスワード変更ハンドラー（最適化）
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    clearErrors();
    
    // デバウンス処理付きバリデーション
    if (username.trim() && value) {
      debouncedValidation(username, value);
    }
  }, [username, clearErrors, debouncedValidation]);

  // ローディング状態の統合管理（メモ化）
  const isFormLoading = useMemo(() => isLoading || isSubmitting, [isLoading, isSubmitting]);

  // キーボードナビゲーション用のハンドラー（最適化）
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Enterキーでフォーム送信（ボタンにフォーカスがない場合）
    if (e.key === 'Enter' && e.target !== e.currentTarget) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  }, [handleSubmit]);

  // 新しいパスワードフォームのキャンセル処理
  const handleNewPasswordCancel = useCallback(() => {
    setShowNewPasswordForm(false);
    setUsername('');
    setPassword('');
    setError(null);
    setValidationErrors([]);
  }, []);

  // エラー表示用のメモ化されたコンポーネント
  const ValidationErrors = useMemo(() => {
    if (validationErrors.length === 0) return null;
    
    return (
      <div 
        id="validation-errors"
        className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md high-contrast:border-black high-contrast:bg-white high-contrast:text-black"
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-start space-x-2">
          <span className="text-amber-600 flex-shrink-0 mt-0.5 high-contrast:text-black" aria-hidden="true">⚠️</span>
          <div className="flex-1">
            <p className="font-medium mb-1">入力内容を確認してください：</p>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((errorMsg, index) => (
                <li key={index}>{errorMsg}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }, [validationErrors]);

  // 認証エラー表示用のメモ化されたコンポーネント
  const AuthError = useMemo(() => {
    if (!error) return null;
    
    return (
      <div 
        className={`text-sm p-3 rounded-md high-contrast:border-black high-contrast:bg-white high-contrast:text-black ${
          error.type === AuthErrorType.NETWORK_ERROR 
            ? 'text-orange-700 bg-orange-50 border border-orange-200'
            : 'text-red-700 bg-red-50 border border-red-200'
        }`}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div className="flex items-start space-x-2">
          <span 
            className={`flex-shrink-0 mt-0.5 high-contrast:text-black ${
              error.type === AuthErrorType.NETWORK_ERROR ? 'text-orange-600' : 'text-red-600'
            }`} 
            aria-hidden="true"
          >
            {error.type === AuthErrorType.NETWORK_ERROR ? '🌐' : '❌'}
          </span>
          <div className="flex-1">
            <p className="font-medium">{error.userFriendlyMessage}</p>
            {error.retryable && (
              <p className="text-xs mt-1 opacity-75">
                しばらく待ってから再度お試しください
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }, [error]);

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-3 sm:p-4 lg:p-6 bg-gradient-to-br from-blue-50 to-indigo-100 dark-auto:bg-gray-900">
      {showNewPasswordForm ? (
        <NewPasswordForm onCancel={handleNewPasswordCancel} />
      ) : (
        <Card 
          variant="healthmate" 
          className="w-full max-w-sm sm:max-w-md lg:max-w-lg high-contrast:border-black focus-trap my-auto"
        >
          <BrandHeader size="lg" />
          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-6 sm:pb-8">
            <form 
              onSubmit={handleSubmit} 
              className="space-y-4 sm:space-y-5"
              onKeyDown={handleKeyDown}
              noValidate
              role="form"
              aria-label="サインインフォーム"
            >
              <div className="space-y-2">
                <label 
                  htmlFor="username" 
                  className="block text-sm font-medium text-gray-700 cursor-pointer high-contrast:text-black"
                >
                  ユーザー名
                  <span className="text-red-500 ml-1" aria-label="必須項目">*</span>
                </label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="ユーザー名を入力"
                  disabled={isFormLoading}
                  required
                  className="motion-reduce:transition-none touch-target high-contrast:border-black high-contrast:bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-200 transition-all duration-200 h-11 px-4 text-base rounded-md"
                  autoComplete="username"
                  aria-describedby={validationErrors.length > 0 ? "validation-errors" : undefined}
                  aria-invalid={validationErrors.length > 0 ? "true" : "false"}
                />
              </div>
              
              <div className="space-y-2">
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium text-gray-700 cursor-pointer high-contrast:text-black"
                >
                  パスワード
                  <span className="text-red-500 ml-1" aria-label="必須項目">*</span>
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="パスワードを入力"
                  disabled={isFormLoading}
                  required
                  className="motion-reduce:transition-none touch-target high-contrast:border-black high-contrast:bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-200 transition-all duration-200 h-11 px-4 text-base rounded-md"
                  autoComplete="current-password"
                  aria-describedby={validationErrors.length > 0 ? "validation-errors" : undefined}
                  aria-invalid={validationErrors.length > 0 ? "true" : "false"}
                />
              </div>

              {/* バリデーションエラーの表示 */}
              {ValidationErrors}

              {/* 認証エラーの表示 */}
              {AuthError}

              <Button 
                type="submit" 
                className="w-full bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md hover:shadow-lg transition-all duration-200 h-11 px-6 py-2.5 text-base rounded-md font-medium motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed touch-target high-contrast:bg-white high-contrast:text-black high-contrast:border-black" 
                disabled={isFormLoading || validationErrors.length > 0}
                aria-describedby={isFormLoading ? "loading-status" : undefined}
              >
                {isFormLoading ? (
                  <>
                    <div className="motion-reduce:animate-none animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 high-contrast:border-black" aria-hidden="true"></div>
                    <span id="loading-status">
                      {isSubmitting ? 'サインイン中...' : '処理中...'}
                    </span>
                  </>
                ) : (
                  'サインイン'
                )}
              </Button>
            </form>

            {/* スクリーンリーダー用の追加情報 */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {isFormLoading && "サインイン処理を実行中です。しばらくお待ちください。"}
              {error && `エラーが発生しました: ${error.userFriendlyMessage}`}
              {validationErrors.length > 0 && `入力エラーが${validationErrors.length}件あります。`}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};