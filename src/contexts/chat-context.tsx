import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { ChatSession, Message } from '@/types/chat';
import { ChatSessionManager } from '@/lib/chat-session-manager';

interface ChatContextType {
  chatSessions: ChatSession[];
  currentChatSession: ChatSession | null;
  isLoading: boolean;
  createNewChatSession: () => void;
  switchChatSession: (chatSessionId: string) => void;
  deleteChatSession: (chatSessionId: string) => void;
  updateChatSessionTitle: (chatSessionId: string, title: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp' | 'chatSessionId'> & { id?: string }) => void;
  updateMessage: (messageId: string, content: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatSession, setCurrentChatSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 最新の状態を参照するためのRef
  const chatSessionsRef = useRef<ChatSession[]>([]);
  const currentChatSessionRef = useRef<ChatSession | null>(null);

  // Refを常に最新の状態に同期
  useEffect(() => {
    chatSessionsRef.current = chatSessions;
  }, [chatSessions]);

  useEffect(() => {
    currentChatSessionRef.current = currentChatSession;
  }, [currentChatSession]);

  useEffect(() => {
    initializeChatSessions();
  }, []);

  /**
   * チャットセッションの初期化
   */
  const initializeChatSessions = () => {
    try {
      console.log('🚀 Initializing chat sessions...');
      setIsLoading(true);
      
      // localStorageからチャットセッションを復元
      const savedChatSessions = ChatSessionManager.loadChatSessions();
      const activeSessionId = ChatSessionManager.loadActiveSessionId();
      
      console.log('📂 Loaded from localStorage:', {
        savedSessionsCount: savedChatSessions.length,
        activeSessionId,
        savedSessions: savedChatSessions.map(s => ({ id: s.id, title: s.title, messageCount: s.messages.length }))
      });
      
      if (savedChatSessions.length === 0) {
        // 初回訪問時は新しいセッションを作成
        console.log('🆕 Creating new session (first visit)');
        const newSession = ChatSessionManager.createNewChatSession();
        const sessions = [newSession];
        
        setChatSessions(sessions);
        setCurrentChatSession(newSession);
        
        ChatSessionManager.saveChatSessions(sessions);
        ChatSessionManager.saveActiveSessionId(newSession.id);
        
        console.log('✅ New session created:', {
          sessionId: newSession.id,
          title: newSession.title
        });
      } else {
        // セッションを新しい順（更新日時の降順）でソート
        const sortedSessions = [...savedChatSessions].sort((a, b) => 
          b.updatedAt.getTime() - a.updatedAt.getTime()
        );
        setChatSessions(sortedSessions);
        // アクティブなセッションを探す
        let activeSession = null;
        if (activeSessionId) {
          activeSession = ChatSessionManager.getSessionById(sortedSessions, activeSessionId);
        }
        
        if (!activeSession) {
          // アクティブなセッションが見つからない場合、最新のセッション（ソート後の最初）を使用
          activeSession = sortedSessions[0];
          ChatSessionManager.saveActiveSessionId(activeSession.id);
        }
        
        setCurrentChatSession(activeSession);
        
        console.log('✅ Sessions restored:', {
          totalSessions: sortedSessions.length,
          activeSessionId: activeSession.id,
          activeSessionTitle: activeSession.title,
          activeSessionMessageCount: activeSession.messages.length
        });
      }
    } catch (error) {
      console.error('❌ Chat initialization failed:', error);
      // エラー時は新しいセッションを作成
      const newSession = ChatSessionManager.createNewChatSession();
      setChatSessions([newSession]);
      setCurrentChatSession(newSession);
      
      console.log('🔄 Fallback session created:', newSession.id);
    } finally {
      setIsLoading(false);
      console.log('🏁 Chat initialization complete');
    }
  };

  /**
   * 新しいチャットセッションを作成
   */
  const createNewChatSession = () => {
    const newSession = ChatSessionManager.createNewChatSession();
    // 新しいセッションを配列の先頭に追加（最新が上に表示される）
    const updatedSessions = ChatSessionManager.setActiveSession(
      [newSession, ...chatSessions],
      newSession.id
    );
    
    setChatSessions(updatedSessions);
    setCurrentChatSession(newSession);
    
    ChatSessionManager.saveChatSessions(updatedSessions);
    ChatSessionManager.saveActiveSessionId(newSession.id);
  };

  /**
   * チャットセッションを切り替え
   */
  const switchChatSession = (chatSessionId: string) => {
    const session = ChatSessionManager.getSessionById(chatSessions, chatSessionId);
    if (!session) {
      console.error('Session not found:', chatSessionId);
      return;
    }

    const updatedSessions = ChatSessionManager.setActiveSession(chatSessions, chatSessionId);
    
    setChatSessions(updatedSessions);
    setCurrentChatSession(session);
    
    ChatSessionManager.saveChatSessions(updatedSessions);
    ChatSessionManager.saveActiveSessionId(chatSessionId);
  };

  /**
   * チャットセッションを削除
   */
  const deleteChatSession = (chatSessionId: string) => {
    const updatedSessions = ChatSessionManager.deleteSession(chatSessions, chatSessionId);
    
    // 削除されたセッションが現在のセッションの場合
    if (currentChatSession?.id === chatSessionId) {
      if (updatedSessions.length === 0) {
        // 全てのセッションが削除された場合、新しいセッションを作成
        const newSession = ChatSessionManager.createNewChatSession();
        const newSessions = [newSession];
        
        setChatSessions(newSessions);
        setCurrentChatSession(newSession);
        
        ChatSessionManager.saveChatSessions(newSessions);
        ChatSessionManager.saveActiveSessionId(newSession.id);
      } else {
        // 他のセッションに切り替え（最新のセッション = 配列の最初）
        const nextSession = updatedSessions[0];
        const sessionsWithActive = ChatSessionManager.setActiveSession(updatedSessions, nextSession.id);
        
        setChatSessions(sessionsWithActive);
        setCurrentChatSession(nextSession);
        
        ChatSessionManager.saveChatSessions(sessionsWithActive);
        ChatSessionManager.saveActiveSessionId(nextSession.id);
      }
    } else {
      setChatSessions(updatedSessions);
      ChatSessionManager.saveChatSessions(updatedSessions);
    }
  };

  /**
   * チャットセッションのタイトルを更新
   */
  const updateChatSessionTitle = useCallback((chatSessionId: string, title: string) => {
    console.log('🏷️ updateChatSessionTitle called:', {
      chatSessionId,
      title,
      currentSessionsCount: chatSessionsRef.current.length,
      availableSessions: chatSessionsRef.current.map(s => ({ id: s.id, title: s.title }))
    });

    const updatedSessions = ChatSessionManager.updateSessionTitle(chatSessionsRef.current, chatSessionId, title);
    
    // タイトル更新後、セッションを新しい順にソート
    const sortedSessions = [...updatedSessions].sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
    
    console.log('🔄 Sessions after updateSessionTitle:', {
      originalSessionCount: chatSessionsRef.current.length,
      updatedSessionCount: sortedSessions.length,
      targetSessionId: chatSessionId
    });

    // Refを先に更新
    chatSessionsRef.current = sortedSessions;
    setChatSessions(sortedSessions);
    
    // 現在のセッションのタイトルが更新された場合
    if (currentChatSessionRef.current?.id === chatSessionId) {
      const updatedCurrentSession = { ...currentChatSessionRef.current, title, updatedAt: new Date() };
      currentChatSessionRef.current = updatedCurrentSession;
      setCurrentChatSession(updatedCurrentSession);
    }
    
    ChatSessionManager.saveChatSessions(sortedSessions);
  }, []);

  /**
   * メッセージを追加
   */
  const addMessage = useCallback((messageData: Omit<Message, 'id' | 'timestamp' | 'chatSessionId'> & { id?: string }) => {
    console.log('🔍 addMessage function called:', {
      hasCurrentChatSession: !!currentChatSessionRef.current,
      currentChatSessionId: currentChatSessionRef.current?.id,
      messageRole: messageData.role,
      messageId: messageData.id,
      contentLength: messageData.content.length,
      currentSessionsCount: chatSessionsRef.current.length
    });

    if (!currentChatSessionRef.current) {
      console.error('❌ No active chat session - cannot add message:', {
        chatSessions: chatSessionsRef.current.length,
        messageData
      });
      return;
    }

    const message: Message = {
      id: messageData.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      chatSessionId: currentChatSessionRef.current.id,
      role: messageData.role,
      content: messageData.content,
    };

    console.log('➕ addMessage called:', {
      messageId: message.id,
      role: message.role,
      contentLength: message.content.length,
      sessionId: currentChatSessionRef.current.id,
      currentMessageCount: currentChatSessionRef.current.messages.length
    });

    const updatedSessions = ChatSessionManager.addMessageToSession(
      chatSessionsRef.current,
      currentChatSessionRef.current.id,
      message
    );

    // メッセージ追加後、セッションを新しい順にソート
    const sortedSessions = [...updatedSessions].sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    console.log('🔄 Sessions after addMessageToSession:', {
      originalSessionCount: chatSessionsRef.current.length,
      updatedSessionCount: updatedSessions.length,
      targetSessionId: currentChatSessionRef.current.id,
      originalSessions: chatSessionsRef.current.map(s => ({ id: s.id, messageCount: s.messages.length })),
      updatedSessions: updatedSessions.map(s => ({ id: s.id, messageCount: s.messages.length }))
    });

    // 現在のセッションを更新
    const updatedCurrentSession = ChatSessionManager.getSessionById(sortedSessions, currentChatSessionRef.current.id);
    if (updatedCurrentSession) {
      console.log('✅ Session updated after addMessage:', {
        sessionId: updatedCurrentSession.id,
        messageCount: updatedCurrentSession.messages.length,
        lastMessageId: updatedCurrentSession.messages[updatedCurrentSession.messages.length - 1]?.id
      });
      
      // Refを先に更新（重要！）
      chatSessionsRef.current = sortedSessions;
      currentChatSessionRef.current = updatedCurrentSession;
      
      // React状態を更新
      setChatSessions(sortedSessions);
      setCurrentChatSession(updatedCurrentSession);
      
      console.log('🔄 After state update - Ref status:', {
        refSessionsCount: chatSessionsRef.current.length,
        refCurrentSessionId: currentChatSessionRef.current?.id,
        refCurrentSessionMessageCount: currentChatSessionRef.current?.messages?.length
      });
      
      // 最初のメッセージの場合、タイトルを自動生成
      if (updatedCurrentSession.messages.length === 1 && messageData.role === 'user') {
        const autoTitle = ChatSessionManager.generateTitleFromMessage(messageData.content);
        updateChatSessionTitle(currentChatSessionRef.current.id, autoTitle);
      }
    } else {
      console.error('❌ Failed to get updated session:', currentChatSessionRef.current.id);
      console.error('Available sessions:', sortedSessions.map(s => ({ id: s.id, messageCount: s.messages.length })));
    }

    ChatSessionManager.saveChatSessions(sortedSessions);
  }, []); // 依存関係なし（Refを使用するため）

  /**
   * メッセージを更新（ストリーミング用）
   */
  const updateMessage = useCallback((messageId: string, content: string) => {
    console.log('🔄 updateMessage called:', {
      messageId,
      contentLength: content.length,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      hasCurrentChatSession: !!currentChatSessionRef.current,
      currentChatSessionId: currentChatSessionRef.current?.id,
      chatSessionsCount: chatSessionsRef.current.length,
      availableSessions: chatSessionsRef.current.map(s => ({ id: s.id, messageCount: s.messages.length }))
    });

    if (!currentChatSessionRef.current) {
      console.error('❌ No active chat session');
      return;
    }

    // 最新のchatSessions配列から現在のセッションを取得
    const latestSession = ChatSessionManager.getSessionById(chatSessionsRef.current, currentChatSessionRef.current.id);
    if (!latestSession) {
      console.error('❌ Latest session not found:', currentChatSessionRef.current.id);
      console.error('Available sessions:', chatSessionsRef.current.map(s => ({ id: s.id, messageCount: s.messages.length })));
      return;
    }

    console.log('🔍 Latest session found:', {
      sessionId: latestSession.id,
      messageCount: latestSession.messages.length,
      targetMessageExists: latestSession.messages.some(m => m.id === messageId)
    });

    const updatedSessions = chatSessionsRef.current.map(session => {
      if (session.id === currentChatSessionRef.current!.id) {
        const updatedMessages = session.messages.map(message => {
          if (message.id === messageId) {
            console.log('✅ Message found and updated:', messageId);
            return { ...message, content };
          }
          return message;
        });
        
        // メッセージが見つからなかった場合のエラーログ
        const messageFound = session.messages.some(m => m.id === messageId);
        if (!messageFound) {
          console.error('❌ Message not found for update:', {
            messageId,
            sessionId: session.id,
            availableMessages: session.messages.map(m => ({ id: m.id, role: m.role }))
          });
          return session; // 変更せずに返す
        }
        
        return { ...session, messages: updatedMessages, updatedAt: new Date() };
      }
      return session;
    });

    // メッセージ更新後、セッションを新しい順にソート
    const sortedSessions = [...updatedSessions].sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    // 現在のセッションを更新
    const updatedCurrentSession = ChatSessionManager.getSessionById(sortedSessions, currentChatSessionRef.current.id);
    if (updatedCurrentSession) {
      console.log('✅ Current session updated, message count:', updatedCurrentSession.messages.length);
      
      // Refを先に更新（重要！）
      chatSessionsRef.current = sortedSessions;
      currentChatSessionRef.current = updatedCurrentSession;
      
      // React状態を更新
      setChatSessions(sortedSessions);
      setCurrentChatSession(updatedCurrentSession);
    } else {
      console.error('❌ Failed to get updated current session');
    }

    ChatSessionManager.saveChatSessions(sortedSessions);
  }, []); // 依存関係なし（Refを使用するため）

  const contextValue: ChatContextType = {
    chatSessions,
    currentChatSession,
    isLoading,
    createNewChatSession,
    switchChatSession,
    deleteChatSession,
    updateChatSessionTitle,
    addMessage,
    updateMessage,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

/**
 * ChatContextを使用するためのカスタムフック
 */
export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};