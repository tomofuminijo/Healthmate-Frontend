/**
 * CacheManager - ブラウザキャッシュ管理クラス
 * 新しいデプロイ後のキャッシュ問題を解決
 */
export class CacheManager {
  private static readonly APP_VERSION_KEY = 'healthmate-app-version';
  private static readonly CACHE_KEYS = [
    'healthmate-auth-session',
    'healthmate-persistent-session',
    'healthmate-user-preferences',
    'healthmate-chat-history',
  ];

  /**
   * アプリケーションバージョンをチェックし、必要に応じてキャッシュをクリア
   */
  static checkAndClearCacheIfNeeded(): void {
    try {
      const currentVersion = this.getCurrentAppVersion();
      const storedVersion = localStorage.getItem(this.APP_VERSION_KEY);

      console.log('App version check:', {
        current: currentVersion,
        stored: storedVersion,
      });

      if (!storedVersion || storedVersion !== currentVersion) {
        console.log('App version changed, clearing cache');
        this.clearAllCache();
        localStorage.setItem(this.APP_VERSION_KEY, currentVersion);
      }
    } catch (error) {
      console.error('Failed to check app version:', error);
      // エラーが発生した場合、安全のためキャッシュをクリア
      this.clearAllCache();
    }
  }

  /**
   * 現在のアプリケーションバージョンを取得
   * ビルド時のタイムスタンプまたは環境変数から取得
   */
  private static getCurrentAppVersion(): string {
    // Viteのビルド時に設定される環境変数
    const buildVersion = import.meta.env.VITE_APP_VERSION;
    if (buildVersion) {
      return buildVersion;
    }

    // フォールバック: 現在の日時を使用
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  }

  /**
   * 全てのアプリケーションキャッシュをクリア
   */
  static clearAllCache(): void {
    try {
      console.log('Clearing all application cache');

      // localStorage からアプリケーション関連のキーを削除
      this.CACHE_KEYS.forEach(key => {
        localStorage.removeItem(key);
      });

      // sessionStorage からアプリケーション関連のキーを削除
      this.CACHE_KEYS.forEach(key => {
        sessionStorage.removeItem(key);
      });

      // Service Worker キャッシュをクリア（存在する場合）
      this.clearServiceWorkerCache();

      console.log('All application cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Service Worker キャッシュをクリア
   */
  private static async clearServiceWorkerCache(): Promise<void> {
    try {
      if ('serviceWorker' in navigator && 'caches' in window) {
        const cacheNames = await caches.keys();
        const healthmateCaches = cacheNames.filter(name => 
          name.includes('healthmate') || name.includes('workbox')
        );

        await Promise.all(
          healthmateCaches.map(cacheName => caches.delete(cacheName))
        );

        console.log('Service Worker caches cleared:', healthmateCaches);
      }
    } catch (error) {
      console.error('Failed to clear Service Worker cache:', error);
    }
  }

  /**
   * 認証関連キャッシュのみをクリア
   */
  static clearAuthCache(): void {
    try {
      console.log('Clearing authentication cache');
      
      const authKeys = [
        'healthmate-auth-session',
        'healthmate-persistent-session',
      ];

      authKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      console.log('Authentication cache cleared');
    } catch (error) {
      console.error('Failed to clear auth cache:', error);
    }
  }

  /**
   * 強制リロード（キャッシュ無効化）
   */
  static forceReload(): void {
    try {
      console.log('Forcing page reload with cache bypass');
      
      // キャッシュをクリアしてからリロード
      this.clearAllCache();
      
      // ハードリロード（Ctrl+F5相当）
      window.location.reload();
    } catch (error) {
      console.error('Failed to force reload:', error);
      // フォールバック: 通常のリロード
      window.location.reload();
    }
  }

  /**
   * デバッグ情報を取得
   */
  static getDebugInfo(): object {
    return {
      appVersion: this.getCurrentAppVersion(),
      storedVersion: localStorage.getItem(this.APP_VERSION_KEY),
      cacheKeys: this.CACHE_KEYS.map(key => ({
        key,
        localStorage: !!localStorage.getItem(key),
        sessionStorage: !!sessionStorage.getItem(key),
      })),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
  }
}