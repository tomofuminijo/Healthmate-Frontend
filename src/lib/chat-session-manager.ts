import { ChatSession, Message } from '@/types/chat';

/**
 * ChatSessionManager - チャットセッション管理クラス
 * localStorageを使用してチャットセッションとメッセージ履歴を管理
 */
export class ChatSessionManager {
  private static readonly CHAT_STORAGE_KEY = 'healthmate-chat-sessions';
  private static readonly ACTIVE_SESSION_KEY = 'healthmate-active-session-id';

  /**
   * チャットセッションをlocalStorageに保存
   */
  static saveChatSessions(chatSessions: ChatSession[]): void {
    try {
      const serialized = JSON.stringify(
        chatSessions.map(session => ({
          ...session,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString(),
          })),
        }))
      );
      localStorage.setItem(this.CHAT_STORAGE_KEY, serialized);
    } catch (error) {
      console.error('Failed to save chat sessions:', error);
      throw new Error('チャットセッションの保存に失敗しました');
    }
  }

  /**
   * localStorageからチャットセッションを読み込み
   */
  static loadChatSessions(): ChatSession[] {
    try {
      const stored = localStorage.getItem(this.CHAT_STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);
      return parsed.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      }));
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      // 破損したデータをクリア
      this.clearChatSessions();
      return [];
    }
  }

  /**
   * チャットセッションをlocalStorageから削除
   */
  static clearChatSessions(): void {
    try {
      localStorage.removeItem(this.CHAT_STORAGE_KEY);
      localStorage.removeItem(this.ACTIVE_SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear chat sessions:', error);
    }
  }

  /**
   * チャットセッションIDを生成（33文字以上、CoachAI要件）
   */
  static generateChatSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const random2 = Math.random().toString(36).substring(2, 15);
    
    // "healthmate-chat-" (16文字) + timestamp (13文字) + "-" (1文字) + random (26文字) = 56文字
    const sessionId = `healthmate-chat-${timestamp}-${random}${random2}`;
    
    console.log('Generated session ID:', sessionId, 'Length:', sessionId.length);
    return sessionId;
  }

  /**
   * 新しいチャットセッションを作成
   */
  static createNewChatSession(): ChatSession {
    const now = new Date();
    return {
      id: this.generateChatSessionId(),
      title: '新しいチャット',
      createdAt: now,
      updatedAt: now,
      messages: [], // 空のChat_History（メッセージやり取り履歴）で開始
      isActive: true,
    };
  }

  /**
   * アクティブなセッションIDを保存
   */
  static saveActiveSessionId(sessionId: string): void {
    try {
      localStorage.setItem(this.ACTIVE_SESSION_KEY, sessionId);
    } catch (error) {
      console.error('Failed to save active session ID:', error);
    }
  }

  /**
   * アクティブなセッションIDを取得
   */
  static loadActiveSessionId(): string | null {
    try {
      return localStorage.getItem(this.ACTIVE_SESSION_KEY);
    } catch (error) {
      console.error('Failed to load active session ID:', error);
      return null;
    }
  }

  /**
   * セッションにメッセージを追加または更新
   */
  static addMessageToSession(
    sessions: ChatSession[],
    sessionId: string,
    message: Message
  ): ChatSession[] {
    return sessions.map(session => {
      if (session.id === sessionId) {
        // 既存のメッセージを探す
        const existingMessageIndex = session.messages.findIndex(m => m.id === message.id);
        
        if (existingMessageIndex >= 0) {
          // 既存メッセージを更新
          const updatedMessages = [...session.messages];
          updatedMessages[existingMessageIndex] = message;
          return {
            ...session,
            messages: updatedMessages,
            updatedAt: new Date(),
          };
        } else {
          // 新しいメッセージを追加
          return {
            ...session,
            messages: [...session.messages, message],
            updatedAt: new Date(),
          };
        }
      }
      return session;
    });
  }

  /**
   * セッションのタイトルを更新
   */
  static updateSessionTitle(
    sessions: ChatSession[],
    sessionId: string,
    title: string
  ): ChatSession[] {
    return sessions.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          title,
          updatedAt: new Date(),
        };
      }
      return session;
    });
  }

  /**
   * セッションを削除
   */
  static deleteSession(sessions: ChatSession[], sessionId: string): ChatSession[] {
    return sessions.filter(session => session.id !== sessionId);
  }

  /**
   * アクティブなセッションを設定
   */
  static setActiveSession(sessions: ChatSession[], sessionId: string): ChatSession[] {
    return sessions.map(session => ({
      ...session,
      isActive: session.id === sessionId,
    }));
  }

  /**
   * セッションIDからセッションを取得
   */
  static getSessionById(sessions: ChatSession[], sessionId: string): ChatSession | null {
    return sessions.find(session => session.id === sessionId) || null;
  }

  /**
   * 最新のメッセージからタイトルを生成
   */
  static generateTitleFromMessage(message: string): string {
    const maxLength = 30;
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength) + '...';
  }
}