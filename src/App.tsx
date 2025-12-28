import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { ChatProvider } from '@/contexts/chat-context';
import { EnvironmentProvider } from '@/components/providers/EnvironmentProvider';
import { ProtectedRoute } from '@/components/protected-route';
import { SignInForm } from '@/components/sign-in-form';
import { ChatInterface } from '@/components/chat-interface';
import { ErrorBoundary } from '@/components/error-display';
import { MobileSidebar, DesktopSidebar } from '@/components/mobile-sidebar';
import { config } from '@/config/environment';
import { CacheManager } from '@/lib/cache-manager';
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useChat } from '@/contexts/chat-context';
import { useEdgeSwipeGesture } from '@/hooks/use-swipe-gesture';
import { logger } from '@/lib/logger';

/**
 * チャットテスト画面コンポーネント
 */
const ChatTestScreen: React.FC = () => {
  const { authSession, logout } = useAuth();
  const { 
    chatSessions, 
    currentChatSession, 
    createNewChatSession, 
    switchChatSession, 
    deleteChatSession,
    updateChatSessionTitle,
    isLoading
  } = useChat();

  // スワイプジェスチャーでサイドバーを開く
  useEdgeSwipeGesture({
    onEdgeSwipeRight: () => {
      logger.debug('🖐️ Edge swipe detected - opening sidebar');
      const event = new CustomEvent('toggleMobileSidebar');
      window.dispatchEvent(event);
    },
    edgeThreshold: 30, // 画面左端30px以内からのスワイプ
    swipeThreshold: 80  // 80px以上のスワイプで反応
  });

  // チャットセッション状態のログ出力
  React.useEffect(() => {
    logger.debug('🖥️ ChatTestScreen render:', {
      isLoading,
      chatSessionsCount: chatSessions.length,
      hasCurrentSession: !!currentChatSession,
      currentSessionId: currentChatSession?.id,
      currentSessionMessageCount: currentChatSession?.messages?.length
    });
  }, [isLoading, chatSessions.length, currentChatSession?.id, currentChatSession?.messages?.length]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">💬</div>
          <p className="text-sm text-muted-foreground">チャットセッションを初期化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* モバイルサイドバー - アプリケーション全体のトップレベルに配置 */}
      <MobileSidebar
        chatSessions={chatSessions}
        currentChatSession={currentChatSession}
        onSwitchSession={switchChatSession}
        onDeleteSession={deleteChatSession}
        onUpdateSessionTitle={updateChatSessionTitle}
        onCreateNewSession={createNewChatSession}
        authSession={authSession || undefined}
      />

      {/* ヘッダー - Fixed Position で完全分離 */}
      <div 
        className="fixed top-0 left-0 right-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ height: '73px' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 h-full">
          <div className="flex justify-between items-center h-full">
            <div className="flex items-center gap-4">
              {/* モバイルハンバーガーメニューボタン - ヘッダー内に配置 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // MobileSidebarの開閉状態を制御するためのイベントを発火
                  const event = new CustomEvent('toggleMobileSidebar');
                  window.dispatchEvent(event);
                }}
                className="md:hidden" // デスクトップでは非表示
                aria-label="チャット一覧を開く"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <h1 className="text-xl font-semibold">Healthmate</h1>
              <div className="text-sm text-muted-foreground hidden sm:block">
                {currentChatSession?.title || '新しいチャット'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={createNewChatSession}
                className="hidden md:inline-flex" // モバイルでは非表示（サイドバー内にあるため）
              >
                新しいチャット
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア - ヘッダー下に配置 */}
      <div 
        className="relative"
        style={{ 
          marginTop: '73px',
          height: 'calc(100vh - 73px)'
        }}
      >
        {/* デスクトップサイドバー - Fixed Position で完全分離 */}
        <div 
          className="hidden md:block fixed left-0 w-80 bg-muted/20 border-r z-10"
          style={{ 
            top: '73px',
            height: 'calc(100vh - 73px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          <DesktopSidebar
            chatSessions={chatSessions}
            currentChatSession={currentChatSession}
            onSwitchSession={switchChatSession}
            onDeleteSession={deleteChatSession}
            onUpdateSessionTitle={updateChatSessionTitle}
            onCreateNewSession={createNewChatSession}
            authSession={authSession || undefined}
          />
        </div>

        {/* メインチャットエリア - サイドバー分のマージンで独立 */}
        <div 
          className="md:ml-80 h-full"
          style={{ 
            height: 'calc(100vh - 73px)',
            overflow: currentChatSession?.messages?.length && currentChatSession.messages.length > 0 ? 'auto' : 'hidden',
            overscrollBehavior: 'contain'
          }}
        >
          <ChatInterface className="h-full" />
        </div>
      </div>
    </div>
  );
};

/**
 * ダッシュボードコンポーネント（認証後のメイン画面）
 */
const Dashboard: React.FC = () => {
  return <ChatTestScreen />;
};

function App() {
  // アプリケーション初期化時にキャッシュチェックを実行
  React.useEffect(() => {
    try {
      logger.info('🚀 Healthmate App initializing...');
      
      // キャッシュバージョンチェック（新しいデプロイ後の問題を防ぐ）
      CacheManager.checkAndClearCacheIfNeeded();
      
      logger.info('✅ App initialization completed');
    } catch (error) {
      logger.error('❌ App initialization failed:', error);
      // 初期化エラーが発生した場合、安全のためキャッシュをクリア
      CacheManager.clearAllCache();
    }
  }, []);

  return (
    <ErrorBoundary>
      <EnvironmentProvider>
        <Router>
          <AuthProvider cognitoConfig={config.cognito}>
            <ChatProvider>
              <Routes>
                <Route path="/signin" element={<SignInForm />} />
                <Route path="/sign-in" element={<SignInForm />} />
                {/* 後方互換性のため /login も残す */}
                <Route path="/login" element={<SignInForm />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </ChatProvider>
          </AuthProvider>
        </Router>
      </EnvironmentProvider>
    </ErrorBoundary>
  );
}

export default App;