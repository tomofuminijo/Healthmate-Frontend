import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { ChatProvider } from '@/contexts/chat-context';
import { ProtectedRoute } from '@/components/protected-route';
import { LoginForm } from '@/components/login-form';
import { ChatInterface } from '@/components/chat-interface';
import { ErrorBoundary } from '@/components/error-display';
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
              <h1 className="text-xl font-semibold">Healthmate</h1>
              <div className="text-sm text-muted-foreground">
                {currentChatSession?.title || '新しいチャット'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={createNewChatSession}
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
        {/* サイドバー - セッション一覧 */}
        <div className="w-80 border-r bg-muted/20 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-medium text-sm text-muted-foreground">
              チャットセッション ({chatSessions.length})
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                    session.id === currentChatSession?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => switchChatSession(session.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {session.title}
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {session.messages.length}件のメッセージ
                      </div>
                      <div className="text-xs opacity-50 mt-1">
                        {session.updatedAt.toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                    {chatSessions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChatSession(session.id);
                        }}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* システム情報 */}
          <div className="p-4 border-t bg-background/50">
            <div className="text-xs text-muted-foreground space-y-1">
              <div><strong>ユーザー:</strong> {authSession?.username}</div>
              <div><strong>セッションID:</strong> {currentChatSession?.id.slice(-8)}...</div>
            </div>
          </div>
        </div>

        {/* メインチャットエリア */}
        <div className="flex-1 flex flex-col">
          <ChatInterface />
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