import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  useEffect(() => {
    initializeChatSessions();
  }, []);

  /**
   * チャットセッションの初期化
   */
  const initializeChatSessions = () => {
    try {
      setIsLoading(true);
      
      // localStorageからチャットセッションを復元
      const savedChatSessions = ChatSessionManager.loadChatSessions();
      const activeSessionId = ChatSessionManager.loadActiveSessionId();
      
      if (savedChatSessions.length === 0) {
        // 初回訪問時は新しいセッションを作成
        const newSession = ChatSessionManager.createNewChatSession();
        const sessions = [newSession];
        
        setChatSessions(sessions);
        setCurrentChatSession(newSession);
        
        ChatSessionManager.saveChatSessions(sessions);
        ChatSessionManager.saveActiveSessionId(newSession.id);
      } else {
        setChatSessions(savedChatSessions);
        
        // アクティブなセッションを探す
        let activeSession = null;
        if (activeSessionId) {
          activeSession = ChatSessionManager.getSessionById(savedChatSessions, activeSessionId);
        }
        
        if (!activeSession) {
          // アクティブなセッションが見つからない場合、最新のセッションを使用
          activeSession = savedChatSessions[savedChatSessions.length - 1];
          ChatSessionManager.saveActiveSessionId(activeSession.id);
        }
        
        setCurrentChatSession(activeSession);
      }
    } catch (error) {
      console.error('Chat initialization failed:', error);
      // エラー時は新しいセッションを作成
      const newSession = ChatSessionManager.createNewChatSession();
      setChatSessions([newSession]);
      setCurrentChatSession(newSession);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 新しいチャットセッションを作成
   */
  const createNewChatSession = () => {
    const newSession = ChatSessionManager.createNewChatSession();
    const updatedSessions = ChatSessionManager.setActiveSession(
      [...chatSessions, newSession],
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
        // 他のセッションに切り替え
        const nextSession = updatedSessions[updatedSessions.length - 1];
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
  const updateChatSessionTitle = (chatSessionId: string, title: string) => {
    const updatedSessions = ChatSessionManager.updateSessionTitle(chatSessions, chatSessionId, title);
    
    setChatSessions(updatedSessions);
    
    // 現在のセッションのタイトルが更新された場合
    if (currentChatSession?.id === chatSessionId) {
      setCurrentChatSession({ ...currentChatSession, title, updatedAt: new Date() });
    }
    
    ChatSessionManager.saveChatSessions(updatedSessions);
  };

  /**
   * メッセージを追加
   */
  const addMessage = (messageData: Omit<Message, 'id' | 'timestamp' | 'chatSessionId'> & { id?: string }) => {
    if (!currentChatSession) {
      console.error('No active chat session');
      return;
    }

    const message: Message = {
      id: messageData.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      chatSessionId: currentChatSession.id,
      role: messageData.role,
      content: messageData.content,
    };

    const updatedSessions = ChatSessionManager.addMessageToSession(
      chatSessions,
      currentChatSession.id,
      message
    );

    setChatSessions(updatedSessions);
    
    // 現在のセッションを更新
    const updatedCurrentSession = ChatSessionManager.getSessionById(updatedSessions, currentChatSession.id);
    if (updatedCurrentSession) {
      setCurrentChatSession(updatedCurrentSession);
      
      // 最初のメッセージの場合、タイトルを自動生成
      if (updatedCurrentSession.messages.length === 1 && messageData.role === 'user') {
        const autoTitle = ChatSessionManager.generateTitleFromMessage(messageData.content);
        updateChatSessionTitle(currentChatSession.id, autoTitle);
      }
    }

    ChatSessionManager.saveChatSessions(updatedSessions);
  };

  /**
   * メッセージを更新（ストリーミング用）
   */
  const updateMessage = (messageId: string, content: string) => {
    if (!currentChatSession) {
      console.error('No active chat session');
      return;
    }

    const updatedSessions = chatSessions.map(session => {
      if (session.id === currentChatSession.id) {
        const updatedMessages = session.messages.map(message => {
          if (message.id === messageId) {
            return { ...message, content };
          }
          return message;
        });
        
        // メッセージが見つからなかった場合のエラーログ（重要なので残す）
        const messageFound = session.messages.some(m => m.id === messageId);
        if (!messageFound) {
          console.error('Message not found for update:', messageId);
        }
        
        return { ...session, messages: updatedMessages, updatedAt: new Date() };
      }
      return session;
    });

    setChatSessions(updatedSessions);
    
    // 現在のセッションを更新
    const updatedCurrentSession = ChatSessionManager.getSessionById(updatedSessions, currentChatSession.id);
    if (updatedCurrentSession) {
      setCurrentChatSession(updatedCurrentSession);
    }

    ChatSessionManager.saveChatSessions(updatedSessions);
  };

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