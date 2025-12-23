import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { ChatProvider } from '@/contexts/chat-context';
import { ProtectedRoute } from '@/components/protected-route';
import { LoginForm } from '@/components/login-form';
import { ChatInterface } from '@/components/chat-interface';
import { ErrorBoundary } from '@/components/error-display';
import { MobileSidebar, DesktopSidebar } from '@/components/mobile-sidebar';
import { config, validateConfig } from '@/lib/config';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/auth-context';
import { useChat } from '@/contexts/chat-context';

// 設定の検証
validateConfig();

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
    isLoading
  } = useChat();

  // チャットセッション状態のログ出力
  React.useEffect(() => {
    console.log('🖥️ ChatTestScreen render:', {
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
      console.error('Logout error:', error);
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* ヘッダー */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* モバイルハンバーガーメニュー */}
              <MobileSidebar
                chatSessions={chatSessions}
                currentChatSession={currentChatSession}
                onSwitchSession={switchChatSession}
                onDeleteSession={deleteChatSession}
                onCreateNewSession={createNewChatSession}
                authSession={authSession || undefined}
              />
              
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
      
      <div className="flex-1 flex">
        {/* デスクトップサイドバー */}
        <DesktopSidebar
          chatSessions={chatSessions}
          currentChatSession={currentChatSession}
          onSwitchSession={switchChatSession}
          onDeleteSession={deleteChatSession}
          onCreateNewSession={createNewChatSession}
          authSession={authSession || undefined}
        />

        {/* メインチャットエリア */}
        <div className="flex-1 flex flex-col h-full">
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
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider cognitoConfig={config.cognito}>
          <ChatProvider>
            <Routes>
              <Route path="/login" element={<LoginForm />} />
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
    </ErrorBoundary>
  );
}

export default App;