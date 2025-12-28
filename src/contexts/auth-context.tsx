import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthSession, CognitoConfig } from '@/types/auth';
import { AuthSessionManager } from '@/lib/auth-session-manager';
import { CognitoClient } from '@/lib/cognito-client';
import { logger } from '@/lib/logger';

interface AuthContextType {
  authSession: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  getJwtToken: () => Promise<string | null>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  cognitoConfig: CognitoConfig;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, cognitoConfig }) => {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cognitoClient] = useState(() => new CognitoClient(cognitoConfig));
  const [pendingSignInResult, setPendingSignInResult] = useState<any>(null);

  const isAuthenticated = authSession !== null && AuthSessionManager.isAuthSessionValid(authSession);

  useEffect(() => {
    initializeAuth();
  }, []);

  /**
   * 認証状態の初期化
   * ハイブリッド戦略 + Amplify内部状態確認
   */
  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      // 1. ローカルストレージから認証セッションを復元
      const savedAuthSession = AuthSessionManager.loadAuthSession();
      
      if (savedAuthSession) {
        if (AuthSessionManager.isRefreshTokenValid(savedAuthSession)) {
          // Refresh_Tokenが有効な場合
          if (AuthSessionManager.shouldRefreshJwtToken(savedAuthSession)) {
            // JWT_Tokenの更新が必要
            await refreshJwtToken(savedAuthSession);
          } else {
            // JWT_Tokenがまだ有効
            setAuthSession(savedAuthSession);
          }
        } else {
          // Refresh_Tokenが期限切れ → Auth_Session期限切れ
          AuthSessionManager.clearAuthSession();
          setAuthSession(null);
        }
      } else {
        // 2. ローカルストレージが空の場合、Amplify内部状態を確認
        await checkAmplifyAuthState();
      }
    } catch (error) {
      logger.error('Auth initialization failed:', error);
      AuthSessionManager.clearAuthSession();
      setAuthSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Amplify内部状態の確認
   * ブラウザリフレッシュ後にAmplifyが保持しているトークンを確認
   */
  const checkAmplifyAuthState = async () => {
    try {
      // Amplifyの内部状態からセッション情報を取得
      const session = await cognitoClient.getCurrentSession();
      
      if (session && session.jwtToken) {
        // Amplifyが有効なトークンを保持している場合、ローカルセッションを再構築
        logger.debug('Amplify内部状態からセッションを復元:', session.userId);
        
        const reconstructedSession: AuthSession = {
          userId: session.userId,
          username: session.username,
          email: session.email || '',
          jwtToken: session.jwtToken,
          refreshToken: session.refreshToken,
          tokenExpiry: session.tokenExpiry,
          refreshTokenExpiry: session.refreshTokenExpiry,
          isActive: true,
        };
        
        // 再構築したセッションを保存
        AuthSessionManager.saveAuthSession(reconstructedSession);
        setAuthSession(reconstructedSession);
      } else {
        // Amplifyにも有効なトークンがない場合、完全にログアウト状態
        setAuthSession(null);
      }
    } catch (error) {
      logger.error('Failed to check Amplify auth state:', error);
      // Amplify状態確認に失敗した場合、ログアウト状態とする
      setAuthSession(null);
    }
  };

  /**
   * JWT_Tokenの自動更新
   */
  const refreshJwtToken = async (currentSession: AuthSession) => {
    try {
      const { jwtToken: newJwtToken, tokenExpiry: newExpiry } = await cognitoClient.refreshToken(
        currentSession.refreshToken
      );
      
      const updatedSession = AuthSessionManager.updateJwtToken(
        currentSession,
        newJwtToken,
        newExpiry
      );
      
      setAuthSession(updatedSession);
    } catch (error) {
      logger.error('Token refresh failed:', error);
      // Refresh失敗 → Auth_Session期限切れ
      AuthSessionManager.clearAuthSession();
      setAuthSession(null);
      throw error;
    }
  };

  /**
   * ユーザーサインイン
   */
  const signIn = async (username: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      const newAuthSession = await cognitoClient.signIn(username, password);
      
      AuthSessionManager.saveAuthSession(newAuthSession);
      setAuthSession(newAuthSession);
      setPendingSignInResult(null);
      
      logger.debug('Sign in successful, auth session set:', newAuthSession.username);
    } catch (error) {
      logger.error('Sign in failed:', error);
      
      // 強制パスワード変更が必要な場合
      if (error instanceof Error && error.name === 'NewPasswordRequiredException') {
        setPendingSignInResult((error as any).signInResult);
        // エラーを再スローして、UIで処理できるようにする
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 強制パスワード変更の完了
   */
  const completeNewPassword = async (newPassword: string): Promise<void> => {
    if (!pendingSignInResult) {
      throw new Error('パスワード変更のセッションが見つかりません');
    }

    try {
      setIsLoading(true);
      
      const newAuthSession = await cognitoClient.completeNewPasswordChallenge(
        newPassword, 
        pendingSignInResult
      );
      
      AuthSessionManager.saveAuthSession(newAuthSession);
      setAuthSession(newAuthSession);
      setPendingSignInResult(null);
      
      logger.debug('New password challenge completed, auth session set:', newAuthSession.username);
    } catch (error) {
      logger.error('Complete new password failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ユーザーログアウト
   */
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      await cognitoClient.signOut();
      
      AuthSessionManager.clearAuthSession();
      setAuthSession(null);
    } catch (error) {
      logger.error('Logout failed:', error);
      // エラーが発生してもローカルセッションはクリア
      AuthSessionManager.clearAuthSession();
      setAuthSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 有効なJWT_Tokenを取得
   */
  const getJwtToken = async (): Promise<string | null> => {
    if (!authSession) {
      return null;
    }

    // JWT_Tokenが有効な場合はそのまま返す
    if (AuthSessionManager.isJwtTokenValid(authSession)) {
      return authSession.jwtToken;
    }

    // JWT_Tokenが期限切れの場合、リフレッシュを試行
    if (AuthSessionManager.isRefreshTokenValid(authSession)) {
      try {
        await refreshJwtToken(authSession);
        // リフレッシュ後の最新のセッションから取得
        const updatedSession = AuthSessionManager.loadAuthSession();
        return updatedSession?.jwtToken || null;
      } catch (error) {
        logger.error('Failed to refresh token:', error);
        return null;
      }
    }

    return null;
  };

  /**
   * 手動でのトークンリフレッシュ
   */
  const refreshToken = async (): Promise<void> => {
    if (!authSession) {
      throw new Error('認証セッションが存在しません');
    }

    await refreshJwtToken(authSession);
  };

  const contextValue: AuthContextType = {
    authSession,
    isAuthenticated,
    isLoading,
    signIn,
    completeNewPassword,
    logout,
    getJwtToken,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * AuthContextを使用するためのカスタムフック
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};