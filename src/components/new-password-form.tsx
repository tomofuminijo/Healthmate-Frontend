import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  classifyAuthError, 
  validateNewPassword,
  type AuthError
} from '@/lib/auth-error-handler';
import { logger } from '@/lib/logger';

interface NewPasswordFormProps {
  onCancel: () => void;
}

export const NewPasswordForm: React.FC<NewPasswordFormProps> = ({ onCancel }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<AuthError | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { completeNewPassword, isLoading } = useAuth();

  // エラーメッセージをクリアする
  const clearErrors = useCallback(() => {
    if (error) {
      setError(null);
    }
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  }, [error, validationErrors.length]);

  // リアルタイムバリデーション
  const validateInput = useCallback((newPasswordValue: string, confirmPasswordValue: string) => {
    const validation = validateNewPassword(newPasswordValue, confirmPasswordValue);
    setValidationErrors(validation.errors);
    return validation;
  }, []);

  // デバウンス処理付きバリデーション
  const debouncedValidation = useMemo(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const debouncedFn = (newPasswordValue: string, confirmPasswordValue: string) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        if (newPasswordValue.trim() && confirmPasswordValue.trim()) {
          validateInput(newPasswordValue, confirmPasswordValue);
        }
        timeoutId = null;
      }, 300);
    };

    (debouncedFn as any).cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return debouncedFn as typeof debouncedFn & { cancel: () => void };
  }, [validateInput]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);
    setIsSubmitting(true);

    try {
      // 入力バリデーション
      const validation = validateNewPassword(newPassword, confirmPassword);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        return;
      }

      // パスワード変更実行
      await completeNewPassword(newPassword);
      // 成功時は親コンポーネントで処理される
    } catch (error) {
      logger.error('New password completion error:', error);
      
      // エラーを分類して適切なメッセージを表示
      const authError = classifyAuthError(error);
      setError(authError);
    } finally {
      setIsSubmitting(false);
    }
  }, [newPassword, confirmPassword, completeNewPassword]);

  // 新しいパスワード変更ハンドラー
  const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    clearErrors();
    
    if (value.trim() && confirmPassword) {
      debouncedValidation(value, confirmPassword);
    }
  }, [confirmPassword, clearErrors, debouncedValidation]);

  // パスワード確認変更ハンドラー
  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    clearErrors();
    
    if (newPassword.trim() && value) {
      debouncedValidation(newPassword, value);
    }
  }, [newPassword, clearErrors, debouncedValidation]);

  // ローディング状態の統合管理
  const isFormLoading = useMemo(() => isLoading || isSubmitting, [isLoading, isSubmitting]);

  // バリデーションエラー表示
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
            <p className="font-medium mb-1">パスワード要件を確認してください：</p>
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

  // 認証エラー表示
  const AuthError = useMemo(() => {
    if (!error) return null;
    
    return (
      <div 
        className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-md high-contrast:border-black high-contrast:bg-white high-contrast:text-black"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div className="flex items-start space-x-2">
          <span className="text-red-600 flex-shrink-0 mt-0.5 high-contrast:text-black" aria-hidden="true">❌</span>
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
    <Card variant="healthmate" className="w-full max-w-sm sm:max-w-md lg:max-w-lg high-contrast:border-black">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl font-semibold text-gray-900 high-contrast:text-black">
          新しいパスワードの設定
        </CardTitle>
        <p className="text-sm text-gray-600 high-contrast:text-black mt-2">
          初回ログインのため、新しいパスワードを設定してください
        </p>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-6 sm:pb-8">
        <form 
          onSubmit={handleSubmit} 
          className="space-y-4 sm:space-y-5"
          noValidate
          role="form"
          aria-label="新しいパスワード設定フォーム"
        >
          <div className="space-y-2">
            <label 
              htmlFor="new-password" 
              className="block text-sm font-medium text-gray-700 cursor-pointer high-contrast:text-black"
            >
              新しいパスワード
              <span className="text-red-500 ml-1" aria-label="必須項目">*</span>
            </label>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              value={newPassword}
              onChange={handleNewPasswordChange}
              placeholder="新しいパスワードを入力"
              disabled={isFormLoading}
              required
              className="motion-reduce:transition-none touch-target high-contrast:border-black high-contrast:bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-200 transition-all duration-200 h-11 px-4 text-base rounded-md"
              autoComplete="new-password"
              aria-describedby={validationErrors.length > 0 ? "validation-errors" : "password-requirements"}
              aria-invalid={validationErrors.length > 0 ? "true" : "false"}
            />
          </div>
          
          <div className="space-y-2">
            <label 
              htmlFor="confirm-password" 
              className="block text-sm font-medium text-gray-700 cursor-pointer high-contrast:text-black"
            >
              パスワード確認
              <span className="text-red-500 ml-1" aria-label="必須項目">*</span>
            </label>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder="パスワードを再入力"
              disabled={isFormLoading}
              required
              className="motion-reduce:transition-none touch-target high-contrast:border-black high-contrast:bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-200 transition-all duration-200 h-11 px-4 text-base rounded-md"
              autoComplete="new-password"
              aria-describedby={validationErrors.length > 0 ? "validation-errors" : undefined}
              aria-invalid={validationErrors.length > 0 ? "true" : "false"}
            />
          </div>

          {/* パスワード要件の説明 */}
          <div 
            id="password-requirements"
            className="text-xs text-gray-600 bg-gray-50 border border-gray-200 p-3 rounded-md high-contrast:border-black high-contrast:bg-white high-contrast:text-black"
          >
            <p className="font-medium mb-1">パスワード要件：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>8文字以上128文字以下</li>
              <li>大文字・小文字・数字・記号をそれぞれ含む</li>
            </ul>
          </div>

          {/* バリデーションエラーの表示 */}
          {ValidationErrors}

          {/* 認証エラーの表示 */}
          {AuthError}

          <div className="flex space-x-3">
            <Button 
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 h-11 px-6 py-2.5 text-base rounded-md font-medium motion-reduce:transition-none touch-target high-contrast:bg-white high-contrast:text-black high-contrast:border-black"
              disabled={isFormLoading}
            >
              キャンセル
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md hover:shadow-lg transition-all duration-200 h-11 px-6 py-2.5 text-base rounded-md font-medium motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed touch-target high-contrast:bg-white high-contrast:text-black high-contrast:border-black" 
              disabled={isFormLoading || validationErrors.length > 0}
            >
              {isFormLoading ? (
                <>
                  <div className="motion-reduce:animate-none animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 high-contrast:border-black" aria-hidden="true"></div>
                  パスワード設定中...
                </>
              ) : (
                'パスワードを設定'
              )}
            </Button>
          </div>
        </form>

        {/* スクリーンリーダー用の追加情報 */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isFormLoading && "パスワード設定処理を実行中です。しばらくお待ちください。"}
          {error && `エラーが発生しました: ${error.userFriendlyMessage}`}
          {validationErrors.length > 0 && `入力エラーが${validationErrors.length}件あります。`}
        </div>
      </CardContent>
    </Card>
  );
};