export interface ChatSession {
  id: string; // 33文字以上（CoachAI要件）
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[]; // このセッション内のChat_History（メッセージやり取り履歴）
  isActive: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant'; // 'user': ユーザーが投げたメッセージ, 'assistant': AIから受け取ったメッセージ
  content: string;
  timestamp: Date;
  chatSessionId: string; // どのChatSessionに属するかを示す
}

export interface ChatConfig {
  apiEndpoint: string;
  maxRetries: number;
  timeout: number;
}