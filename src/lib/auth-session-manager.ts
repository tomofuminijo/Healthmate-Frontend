import { AuthSession } from '@/types/auth';

/**
 * AuthSessionManager - 認証セッション管理クラス
 * localStorage + sessionStorage ハイブリッド戦略でJWT/Refresh Token管理を行う
 */
export class AuthSessionManager {
  private static readonly AUTH_SESSION_KEY = 'healthmate-auth-session';
  private static readonly PERSISTENT_SESSION_KEY = 'healthmate-persistent-session';

  /**
   * 認証セッションを保存（ハイブリッド戦略）
   * - sessionStorage: 完全なセッション情報（JWT Token含む）
   * - localStorage: 永続化が必要な情報（Refresh Token、ユーザーID）
   */
  static saveAuthSession(authSession: AuthSession): void {
    try {
      const sessionData = {
        ...authSession,
        tokenExpiry: authSession.tokenExpiry.toISOString(),
        refreshTokenExpiry: authSession.refreshTokenExpiry.toISOString(),
      };

      // sessionStorage: 完全なセッション情報
      sessionStorage.setItem(this.AUTH_SESSION_KEY, JSON.stringify(sessionData));

      // localStorage: 永続化が必要な情報のみ
      const persistentData = {
        userId: authSession.userId,
        username: authSession.username,
        refreshToken: authSession.refreshToken,
        refreshTokenExpiry: authSession.refreshTokenExpiry.toISOString(),
      };
      localStorage.setItem(this.PERSISTENT_SESSION_KEY, JSON.stringify(persistentData));
    } catch (error) {
      console.error('Failed to save auth session:', error);
      throw new Error('認証セッションの保存に失敗しました');
    }
  }

  /**
   * 認証セッションを読み込み（ハイブリッド戦略）
   * 1. sessionStorageから完全なセッションを試行
   * 2. sessionStorageが空の場合、localStorageから永続化データを復元
   */
  static loadAuthSession(): AuthSession | null {
    try {
      // 1. sessionStorageから完全なセッションを試行
      const sessionStored = sessionStorage.getItem(this.AUTH_SESSION_KEY);
      if (sessionStored) {
        const parsed = JSON.parse(sessionStored);
        return {
          ...parsed,
          tokenExpiry: new Date(parsed.tokenExpiry),
          refreshTokenExpiry: new Date(parsed.refreshTokenExpiry),
        };
      }

      // 2. sessionStorageが空の場合、localStorageから永続化データを復元
      const persistentStored = localStorage.getItem(this.PERSISTENT_SESSION_KEY);
      if (persistentStored) {
        const parsed = JSON.parse(persistentStored);
        
        // Refresh Tokenが有効かチェック
        const refreshTokenExpiry = new Date(parsed.refreshTokenExpiry);
        if (refreshTokenExpiry > new Date()) {
          // 部分的なセッション情報を返す（JWT Tokenは後で更新される）
          return {
            userId: parsed.userId,
            username: parsed.username,
            email: '', // 空のemail（後で更新）
            jwtToken: '', // 空のJWT Token（後で更新）
            refreshToken: parsed.refreshToken,
            tokenExpiry: new Date(), // 即座に期限切れとして扱う
            refreshTokenExpiry: refreshTokenExpiry,
            isActive: true,
          };
        } else {
          // Refresh Tokenも期限切れの場合、永続化データをクリア
          this.clearPersistentSession();
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to load auth session:', error);
      // 破損したデータをクリア
      this.clearAuthSession();
      return null;
    }
  }

  /**
   * 認証セッションをクリア（両方のストレージから削除）
   */
  static clearAuthSession(): void {
    try {
      sessionStorage.removeItem(this.AUTH_SESSION_KEY);
      this.clearPersistentSession();
    } catch (error) {
      console.error('Failed to clear auth session:', error);
    }
  }

  /**
   * 永続化セッションをlocalStorageから削除
   */
  static clearPersistentSession(): void {
    try {
      localStorage.removeItem(this.PERSISTENT_SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear persistent session:', error);
    }
  }

  /**
   * JWT_Tokenの有効期限チェック（通常1時間）
   */
  static isJwtTokenValid(authSession: AuthSession): boolean {
    if (!authSession.jwtToken || !authSession.tokenExpiry) {
      return false;
    }
    return new Date() < new Date(authSession.tokenExpiry);
  }

  /**
   * Refresh_Tokenの有効期限チェック（通常30日）
   */
  static isRefreshTokenValid(authSession: AuthSession): boolean {
    if (!authSession.refreshToken || !authSession.refreshTokenExpiry) {
      return false;
    }
    return new Date() < new Date(authSession.refreshTokenExpiry);
  }

  /**
   * JWT_Tokenの更新が必要かチェック
   * 有効期限が5分以内の場合、更新が必要
   */
  static shouldRefreshJwtToken(authSession: AuthSession): boolean {
    if (!authSession.tokenExpiry) {
      return true;
    }
    
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return new Date(authSession.tokenExpiry) < fiveMinutesFromNow;
  }

  /**
   * 認証セッションが完全に有効かチェック
   */
  static isAuthSessionValid(authSession: AuthSession | null): boolean {
    if (!authSession || !authSession.isActive) {
      return false;
    }

    // Refresh_Tokenが有効でない場合、セッション無効
    if (!this.isRefreshTokenValid(authSession)) {
      return false;
    }

    return true;
  }

  /**
   * 新しいJWT_Tokenでセッションを更新
   */
  static updateJwtToken(authSession: AuthSession, newJwtToken: string, newExpiry: Date): AuthSession {
    const updatedSession: AuthSession = {
      ...authSession,
      jwtToken: newJwtToken,
      tokenExpiry: newExpiry,
    };

    this.saveAuthSession(updatedSession);
    return updatedSession;
  }

  /**
   * セッションの最終アクセス時刻を更新
   */
  static touchSession(authSession: AuthSession): AuthSession {
    const updatedSession: AuthSession = {
      ...authSession,
      // 必要に応じて最終アクセス時刻などを追加
    };

    this.saveAuthSession(updatedSession);
    return updatedSession;
  }
}