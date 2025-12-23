import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { BrandHeader } from '@/components/brand-header';
import { 
  classifyAuthError, 
  validateLoginCredentials, 
  AuthErrorType,
  type AuthError,
  type ValidationResult 
} from '@/lib/auth-error-handler';

export const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthError | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isLoading, isAuthenticated } = useAuth();
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
  const clearErrors = () => {
    if (error) {
      setError(null);
    }
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  // リアルタイムバリデーション
  const validateInput = (usernameValue: string, passwordValue: string) => {
    const validation = validateLoginCredentials(usernameValue, passwordValue);
    setValidationErrors(validation.errors);
    return validation;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);
    setIsSubmitting(true);

    try {
      // 入力バリデーション
      const validation = validateLoginCredentials(username, password);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        return;
      }

      // ログイン実行
      await login(username.trim(), password);
      // リダイレクトはuseEffectで処理される
    } catch (error) {
      console.error('Login error:', error);
      
      // エラーを分類して適切なメッセージを表示
      const authError = classifyAuthError(error);
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
  };

  // ローディング状態の統合管理
  const isFormLoading = isLoading || isSubmitting;

  // キーボードナビゲーション用のハンドラー
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enterキーでフォーム送信（ボタンにフォーカスがない場合）
    if (e.key === 'Enter' && e.target !== e.currentTarget) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-3 sm:p-4 lg:p-6 bg-gradient-to-br from-blue-50 to-indigo-100 dark-auto:bg-gray-900">
      <Card className="w-full max-w-sm sm:max-w-md lg:max-w-lg shadow-lg border-0 sm:border high-contrast:border-black focus-trap my-auto">
        <BrandHeader size="lg" />
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-6 sm:pb-8">
          <form 
            onSubmit={handleSubmit} 
            className="space-y-4 sm:space-y-5"
            onKeyDown={handleKeyDown}
            noValidate
            role="form"
            aria-label="ログインフォーム"
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
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearErrors();
                  // リアルタイムバリデーション（デバウンス不要、軽量な処理のため）
                  if (e.target.value.trim() && password) {
                    validateInput(e.target.value, password);
                  }
                }}
                placeholder="ユーザー名を入力"
                disabled={isFormLoading}
                required
                className="motion-reduce:transition-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-base sm:text-sm touch-target high-contrast:border-black high-contrast:bg-white"
                autoComplete="username"
                aria-describedby={validationErrors.length > 0 ? "validation-errors" : undefined}
                aria-invalid={validationErrors.length > 0 ? "true" : "false"}
                tabIndex={1}
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearErrors();
                  // リアルタイムバリデーション
                  if (username.trim() && e.target.value) {
                    validateInput(username, e.target.value);
                  }
                }}
                placeholder="パスワードを入力"
                disabled={isFormLoading}
                required
                className="motion-reduce:transition-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-base sm:text-sm touch-target high-contrast:border-black high-contrast:bg-white"
                autoComplete="current-password"
                aria-describedby={validationErrors.length > 0 ? "validation-errors" : undefined}
                aria-invalid={validationErrors.length > 0 ? "true" : "false"}
                tabIndex={2}
              />
            </div>

            {/* バリデーションエラーの表示 */}
            {validationErrors.length > 0 && (
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
            )}

            {/* 認証エラーの表示 */}
            {error && (
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
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 motion-reduce:transition-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-sm py-2.5 sm:py-2 touch-target high-contrast:bg-white high-contrast:text-black high-contrast:border-black" 
              disabled={isFormLoading || validationErrors.length > 0}
              tabIndex={3}
              aria-describedby={isFormLoading ? "loading-status" : undefined}
            >
              {isFormLoading ? (
                <>
                  <div className="motion-reduce:animate-none animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 high-contrast:border-black" aria-hidden="true"></div>
                  <span id="loading-status">
                    {isSubmitting ? 'ログイン中...' : '処理中...'}
                  </span>
                </>
              ) : (
                'ログイン'
              )}
            </Button>
          </form>

          {/* スクリーンリーダー用の追加情報 */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {isFormLoading && "ログイン処理を実行中です。しばらくお待ちください。"}
            {error && `エラーが発生しました: ${error.userFriendlyMessage}`}
            {validationErrors.length > 0 && `入力エラーが${validationErrors.length}件あります。`}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};