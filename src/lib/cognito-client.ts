import { Amplify } from 'aws-amplify';
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { AuthSession, CognitoConfig } from '@/types/auth';

/**
 * Cognito認証クライアント
 * AWS Amplify Authを使用してCognito認証を管理
 */
export class CognitoClient {
  private config: CognitoConfig;
  private isConfigured = false;

  constructor(config: CognitoConfig) {
    this.config = config;
    this.configureAmplify();
  }

  /**
   * Amplifyの設定
   */
  private configureAmplify(): void {
    if (this.isConfigured) return;

    try {
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId: this.config.userPoolId,
            userPoolClientId: this.config.clientId,
            loginWith: {
              username: true,
            },
          },
        },
      });
      
      this.isConfigured = true;
      console.log('Amplify configured successfully with Cognito:', {
        userPoolId: this.config.userPoolId,
        clientId: this.config.clientId,
        region: this.config.region,
      });
    } catch (error) {
      console.error('Failed to configure Amplify:', error);
      throw new Error('Amplify設定に失敗しました');
    }
  }

  /**
   * ユーザーログイン
   */
  async signIn(username: string, password: string): Promise<AuthSession> {
    try {
      console.log('Attempting to sign in user:', username);
      
      const signInResult = await signIn({
        username,
        password,
      });

      console.log('Sign in result:', signInResult);

      if (signInResult.isSignedIn) {
        // ログイン成功後、ユーザー情報とセッション情報を取得
        const [user, session] = await Promise.all([
          getCurrentUser(),
          fetchAuthSession(),
        ]);

        console.log('Current user:', user);
        console.log('Auth session:', session);

        const authSession: AuthSession = {
          userId: user.userId,
          username: user.username,
          email: user.signInDetails?.loginId || `${username}@example.com`,
          jwtToken: session.tokens?.accessToken?.toString() || '',
          refreshToken: session.tokens?.idToken?.toString() || '', // idTokenを使用
          tokenExpiry: new Date(session.tokens?.accessToken?.payload.exp! * 1000),
          refreshTokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日後（概算）
          isActive: true,
        };

        console.log('Created auth session:', authSession);
        return authSession;
      } else {
        throw new Error('ログインが完了していません');
      }
    } catch (error) {
      console.error('Sign in failed:', error);
      if (error instanceof Error) {
        throw new Error(`ログインに失敗しました: ${error.message}`);
      }
      throw new Error('ログインに失敗しました');
    }
  }

  /**
   * ユーザーログアウト
   */
  async signOut(): Promise<void> {
    try {
      console.log('Signing out user');
      await signOut();
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw new Error('ログアウトに失敗しました');
    }
  }

  /**
   * JWT_Tokenのリフレッシュ
   */
  async refreshToken(_refreshToken: string): Promise<{ jwtToken: string; tokenExpiry: Date }> {
    try {
      console.log('Refreshing auth session');
      const session = await fetchAuthSession({ forceRefresh: true });
      
      if (!session.tokens?.accessToken) {
        throw new Error('新しいトークンの取得に失敗しました');
      }

      const result = {
        jwtToken: session.tokens.accessToken.toString(),
        tokenExpiry: new Date(session.tokens.accessToken.payload.exp! * 1000),
      };

      console.log('Token refreshed successfully:', result);
      return result;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new Error('トークンの更新に失敗しました');
    }
  }

  /**
   * 現在のユーザー情報を取得
   */
  async getCurrentUser(): Promise<{ userId: string; username: string; email: string } | null> {
    try {
      const user = await getCurrentUser();
      return {
        userId: user.userId,
        username: user.username,
        email: user.signInDetails?.loginId || `${user.username}@example.com`,
      };
    } catch (error) {
      console.error('Get current user failed:', error);
      return null;
    }
  }

  /**
   * パスワード変更
   */
  async changePassword(_oldPassword: string, _newPassword: string): Promise<void> {
    try {
      // TODO: AWS Amplify Authを使用した実装
      console.log('Password changed');
    } catch (error) {
      console.error('Change password failed:', error);
      throw new Error('パスワードの変更に失敗しました');
    }
  }

  /**
   * パスワードリセット要求
   */
  async forgotPassword(username: string): Promise<void> {
    try {
      // TODO: AWS Amplify Authを使用した実装
      console.log('Password reset requested for:', username);
    } catch (error) {
      console.error('Forgot password failed:', error);
      throw new Error('パスワードリセット要求に失敗しました');
    }
  }

  /**
   * パスワードリセット確認
   */
  async confirmForgotPassword(username: string, _code: string, _newPassword: string): Promise<void> {
    try {
      // TODO: AWS Amplify Authを使用した実装
      console.log('Password reset confirmed for:', username);
    } catch (error) {
      console.error('Confirm forgot password failed:', error);
      throw new Error('パスワードリセットの確認に失敗しました');
    }
  }
}