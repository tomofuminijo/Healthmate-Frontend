import { AuthSession } from '@/types/auth';

/**
 * AuthSessionManager - 認証セッション管理クラス
 * sessionStorageを使用してJWT/Refresh Token管理を行う
 */
export class AuthSessionManager {
  private static readonly AUTH_STORAGE_KEY = 'healthmate-auth-session';

  /**
   * 認証セッションをsessionStorageに保存
   */
  static saveAuthSession(authSession: AuthSession): void {
    try {
      sessionStorage.setItem(this.AUTH_STORAGE_KEY, JSON.stringify({
        ...authSession,
        tokenExpiry: authSession.tokenExpiry.toISOString(),
        refreshTokenExpiry: authSession.refreshTokenExpiry.toISOString(),
      }));
    } catch (error) {
      console.error('Failed to save auth session:', error);
      throw new Error('認証セッションの保存に失敗しました');
    }
  }

  /**
   * sessionStorageから認証セッションを読み込み
   */
  static loadAuthSession(): AuthSession | null {
    try {
      const stored = sessionStorage.getItem(this.AUTH_STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        tokenExpiry: new Date(parsed.tokenExpiry),
        refreshTokenExpiry: new Date(parsed.refreshTokenExpiry),
      };
    } catch (error) {
      console.error('Failed to load auth session:', error);
      // 破損したデータをクリア
      this.clearAuthSession();
      return null;
    }
  }

  /**
   * 認証セッションをsessionStorageから削除
   */
  static clearAuthSession(): void {
    try {
      sessionStorage.removeItem(this.AUTH_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear auth session:', error);
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