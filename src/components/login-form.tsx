import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 認証状態が変更されたときのリダイレクト処理
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      console.log('User authenticated, redirecting to:', from);
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('ユーザー名とパスワードを入力してください');
      return;
    }

    try {
      await login(username.trim(), password);
      // リダイレクトはuseEffectで処理される
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'ログインに失敗しました。ユーザー名とパスワードを確認してください。');
    }
  };

  const handleTestUser = (testUsername: string) => {
    setUsername(testUsername);
    setPassword('TempPassword123!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Healthmate</CardTitle>
          <CardDescription>
            Cognito UserPool認証テスト
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                ユーザー名
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ユーザー名を入力"
                disabled={isLoading}
                required
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                パスワード
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                disabled={isLoading}
                required
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ログイン中...
                </>
              ) : (
                'ログイン'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">テスト用ユーザー:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleTestUser('healthuser1')}
                disabled={isLoading}
              >
                healthuser1
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleTestUser('healthuser2')}
                disabled={isLoading}
              >
                healthuser2
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleTestUser('demouser')}
                disabled={isLoading}
              >
                demouser
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleTestUser('testuser2')}
                disabled={isLoading}
              >
                testuser2
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              デフォルトパスワード: TempPassword123!
            </p>
          </div>

          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground">
              <strong>Cognito設定:</strong><br/>
              UserPool: us-west-2_tykFYGwK7<br/>
              ClientId: q1m738bplsn2k6orkq0avs589
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};