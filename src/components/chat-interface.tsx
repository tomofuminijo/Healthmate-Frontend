import React from 'react';
import { MessageList } from './message-list';
import { MessageListWithTransitionControl } from './message-list-with-transition-control';
import { MessageInput } from './message-input';
import { ErrorDisplay } from './error-display';
import { ChatLayoutManager, ChatContentContainer } from './chat-layout-manager';
import { ScrollToBottomButtonContainer } from './scroll-to-bottom-button';
import { useChat } from '@/contexts/chat-context';
import { useAuth } from '@/contexts/auth-context';
import { ErrorHandler, AppError } from '@/lib/error-handler';

interface ChatInterfaceProps {
  className?: string;
}

/**
 * ChatInterface コンポーネント
 * Vercel AI SDK統合とエラーハンドリング機能
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({ className }) => {
  const { currentChatSession, addMessage, updateMessage } = useChat();
  const { getJwtToken } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<AppError | null>(null);
  const [serviceHealth, setServiceHealth] = React.useState<{
    available: boolean;
    lastChecked?: Date;
  }>({ available: true });

  /**
   * サービスヘルスチェック（CoachAI API優先）
   */
  const performHealthCheck = React.useCallback(async () => {
    try {
      // JWTトークンを取得してヘルスチェックに使用
      const jwtToken = await getJwtToken();
      
      // 実際のCoachAI APIのヘルスチェックを試行
      const { checkCoachAIHealth } = await import('@/api/chat');
      const health = await checkCoachAIHealth(jwtToken || undefined);
      
      setServiceHealth({
        available: health.available,
        lastChecked: new Date(),
      });
      
      if (health.available) {
        console.log('✅ CoachAI サービスが利用可能です');
        // エラー状態をクリア
        if (error) {
          setError(null);
        }
      } else if (health.error) {
        console.warn('⚠️ CoachAI サービスのヘルスチェックでエラー:', health.error);
        setError(health.error);
      }
    } catch (err) {
      console.warn('⚠️ CoachAI ヘルスチェックに失敗。モックモードで動作します:', err);
      
      // ヘルスチェック失敗は警告レベルとして扱う（モックで動作可能）
      setServiceHealth({
        available: true, // モックAPIで動作可能
        lastChecked: new Date(),
      });
      
      // エラー表示はしない（モックで動作するため）
      setError(null);
    }
  }, [error, getJwtToken]);

  /**
   * 初回ヘルスチェック
   */
  React.useEffect(() => {
    performHealthCheck();
  }, [performHealthCheck]);

  /**
   * メッセージ送信処理（実際のCoachAI API優先）
   * 既存機能を完全に保持しつつ、新しいレイアウトシステムと統合
   */
  const handleSendMessage = async (content: string) => {
    console.log('🚀 handleSendMessage called:', {
      content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      hasCurrentSession: !!currentChatSession,
      sessionId: currentChatSession?.id,
      sessionMessageCount: currentChatSession?.messages?.length,
      hasMessages // 新しいレイアウトシステムの状態も記録
    });

    // エラー状態をクリア
    setError(null);

    // ユーザーメッセージをローカルセッションに保存
    console.log('👤 Adding user message...');
    addMessage({
      role: 'user',
      content,
    });

    setIsLoading(true);

    try {
      // JWT トークンを取得
      const jwtToken = await getJwtToken();
      if (!jwtToken) {
        throw new Error('認証トークンが取得できません');
      }

      if (!currentChatSession) {
        throw new Error('チャットセッションが見つかりません');
      }

      // 実際のCoachAI APIを最初に試行（ストリーミング）
      try {
        console.log('🔗 CoachAI API呼び出し開始 (ストリーミング):', {
          sessionId: currentChatSession.id,
          hasJwtToken: !!jwtToken,
          jwtTokenLength: jwtToken?.length
        });

        const { streamChatMessage } = await import('@/api/chat');
        
        // 空のAIメッセージを先に作成
        const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        console.log('🤖 Creating initial AI message:', aiMessageId);
        
        addMessage({
          role: 'assistant',
          content: '考え中...',
          id: aiMessageId
        });

        // React状態更新の完了を待つ（レイアウト遷移も考慮）
        await new Promise(resolve => setTimeout(resolve, 350)); // 300ms遷移 + 50ms余裕
        
        console.log('⏰ State update wait completed, starting streaming...');

        let accumulatedContent = '';
        
        // ストリーミングでチャンクを受信
        for await (const chunk of streamChatMessage(
          {
            prompt: content,
            sessionId: currentChatSession.id,
            timezone: 'Asia/Tokyo',
            language: 'ja'
          },
          jwtToken
        )) {
          accumulatedContent += chunk;
          
          console.log('📦 Received chunk:', {
            chunk: chunk.substring(0, 50) + (chunk.length > 50 ? '...' : ''),
            chunkLength: chunk.length,
            totalLength: accumulatedContent.length,
            messageId: aiMessageId
          });
          
          // チャンクごとにメッセージを更新（updateMessageを使用）
          updateMessage(aiMessageId, accumulatedContent);
        }
        
        console.log('✅ 実際のCoachAI APIからストリーミング応答完了:', {
          responseLength: accumulatedContent.length,
          sessionId: currentChatSession.id
        });
        
      } catch (apiError) {
        console.warn('⚠️ 実際のCoachAI APIが利用できません。モックAPIにフォールバック:', {
          error: apiError,
          errorType: apiError?.constructor?.name,
          errorMessage: (apiError as Error)?.message
        });
        
        // モックAPIにフォールバック
        const { mockChatAPI } = await import('@/api/mock-chat-server');
        
        const response = await mockChatAPI({
          prompt: content,
          sessionState: {
            sessionAttributes: {
              session_id: currentChatSession.id,
              jwt_token: jwtToken,
              timezone: 'Asia/Tokyo',
              language: 'ja'
            }
          }
        });

        // AIメッセージをローカルセッションに保存
        addMessage({
          role: 'assistant',
          content: response.content + '\n\n*（注：モックAPIからの応答です）*',
        });
        
        console.log('✅ モックAPIから応答を取得しました');
      }
      
      setIsLoading(false);
      
    } catch (err) {
      console.error('Chat error:', err);
      const appError = ErrorHandler.classify(err);
      setError(appError);
      
      // エラーメッセージをチャットに追加
      addMessage({
        role: 'assistant',
        content: `申し訳ございません。${appError.message}`,
      });
      setIsLoading(false);
    }
  };

  /**
   * エラーリトライ処理
   */
  const handleRetry = React.useCallback(async () => {
    setError(null);
    await performHealthCheck();
  }, [performHealthCheck]);

  /**
   * エラー解除処理
   */
  const handleDismissError = React.useCallback(() => {
    setError(null);
  }, []);

  /**
   * 表示用メッセージ
   */
  const displayMessages = React.useMemo(() => {
    if (!currentChatSession) return [];
    return currentChatSession.messages;
  }, [currentChatSession?.messages]);

  /**
   * メッセージが存在するかどうかの判定（改良版）
   */
  const hasMessages = React.useMemo(() => {
    // より厳密な判定: 空のメッセージや無効なメッセージを除外
    const validMessages = displayMessages.filter(message => 
      message && 
      message.content && 
      message.content.trim().length > 0 &&
      message.role && 
      (message.role === 'user' || message.role === 'assistant')
    );
    
    console.log('📊 Message validation:', {
      totalMessages: displayMessages.length,
      validMessages: validMessages.length,
      hasMessages: validMessages.length > 0
    });
    
    return validMessages.length > 0;
  }, [displayMessages]);

  return (
    <ChatLayoutManager 
      hasMessages={hasMessages}
      className={className}
    >
      {/* メインコンテナ: 既存機能のテスト互換性を保つ */}
      <div data-testid="chat-interface">
        {/* エラー表示エリア */}
        {error && (
          <div className="absolute top-0 left-0 right-0 z-50 p-4 border-b bg-background">
            <ChatContentContainer>
              <ErrorDisplay
                error={error}
                onRetry={error.retryable ? handleRetry : undefined}
                onDismiss={handleDismissError}
                compact
              />
            </ChatContentContainer>
          </div>
        )}

        {/* サービス状態表示 */}
        {!serviceHealth.available && !error && (
          <div className="absolute top-0 left-0 right-0 z-40 p-4 border-b bg-yellow-50 dark:bg-yellow-950">
            <ChatContentContainer>
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-sm">
                  CoachAI サービスの状態を確認中...
                </span>
              </div>
            </ChatContentContainer>
          </div>
        )}

        {/* メインチャットコンテンツ */}
        <ChatInterfaceContent
          displayMessages={displayMessages}
          hasMessages={hasMessages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          disabled={!serviceHealth.available && !!error}
          placeholder={
            !serviceHealth.available && !!error
              ? "サービスが利用できません..."
              : "健康について何でもお聞きください..."
          }
        />
      </div>
    </ChatLayoutManager>
  );
};

/**
 * ChatInterfaceContent コンポーネント
 * レイアウトモードに応じてチャットコンテンツを表示
 * 既存機能を完全に保持しつつ、新しいレイアウトシステムと統合
 */
interface ChatInterfaceContentProps {
  displayMessages: any[];
  hasMessages: boolean;
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled: boolean;
  placeholder: string;
}

const ChatInterfaceContent: React.FC<ChatInterfaceContentProps> = ({
  displayMessages,
  hasMessages,
  onSendMessage,
  isLoading,
  disabled,
  placeholder
}) => {
  const messageListRef = React.useRef<HTMLDivElement>(null);

  const handleScrollToBottom = React.useCallback(() => {
    console.log('📍 Scroll to bottom callback triggered');
  }, []);

  // エラーハンドリング: レイアウト遷移中の安全性確保
  const safeOnSendMessage = React.useCallback((content: string) => {
    try {
      onSendMessage(content);
    } catch (error) {
      console.error('❌ Error in message sending:', error);
      // エラーが発生してもUIを壊さない
    }
  }, [onSendMessage]);

  return (
    <>
      {/* 空チャット状態: 中央配置のメッセージ入力 */}
      {!hasMessages && (
        <ChatContentContainer className="flex items-center justify-center min-h-0">
          <div className="w-full max-w-2xl">
            {/* ウェルカムメッセージ */}
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">🏥</div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Healthmate AI コーチ
              </h1>
              <p className="text-muted-foreground">
                健康について何でもお聞きください。パーソナライズされたアドバイスを提供します。
              </p>
            </div>
            
            {/* 中央配置のメッセージ入力 */}
            <MessageInput
              onSendMessage={safeOnSendMessage}
              isLoading={isLoading}
              disabled={disabled}
              placeholder={placeholder}
              layoutMode="empty"
              className="rounded-xl shadow-lg"
            />
          </div>
        </ChatContentContainer>
      )}

      {/* アクティブチャット状態: 通常のチャットレイアウト */}
      {hasMessages && (
        <>
          {/* チャット履歴表示エリア - 入力欄の高さを考慮 */}
          <div className="flex-1 overflow-hidden relative pb-24">
            <ChatContentContainer className="h-full">
              <MessageListWithTransitionControl 
                ref={messageListRef}
                messages={displayMessages}
                className="h-full"
                onScrollToBottom={handleScrollToBottom}
                scrollBehavior="user-only" // ユーザーメッセージのみスクロール（要件6, 7対応）
              />
            </ChatContentContainer>
            
            {/* 最下部スクロールボタン */}
            <ScrollToBottomButtonContainer
              scrollContainerRef={messageListRef}
              hasMessages={hasMessages}
              onScrollToBottom={handleScrollToBottom}
            />
          </div>

          {/* メッセージ入力エリア - 完全固定位置（サイドバー考慮） */}
          <div className="fixed bottom-0 left-0 md:left-80 right-0 z-30 border-t bg-background">
            <ChatContentContainer>
              <MessageInput
                onSendMessage={safeOnSendMessage}
                isLoading={isLoading}
                disabled={disabled}
                placeholder={placeholder}
                layoutMode="active"
                className="border-0 bg-transparent"
              />
            </ChatContentContainer>
          </div>
        </>
      )}
    </>
  );
};