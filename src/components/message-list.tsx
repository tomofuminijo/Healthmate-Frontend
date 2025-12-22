import React, { useEffect, useRef } from 'react';
import { Message } from '@/types/chat';
import { MessageBubble } from './message-bubble';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: Message[];
  className?: string;
}

/**
 * MessageList コンポーネント
 * チャット履歴の表示とスクロール管理を行う
 * シンプルなスクロール表示（仮想化なし）
 */
export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  className 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // デバッグログ
  console.log('📋 MessageList rendering:', {
    messageCount: messages.length,
    messages: messages.map(m => ({ id: m.id, role: m.role, contentLength: m.content.length }))
  });

  // メッセージを日付区切りと共に処理
  const messageItems = React.useMemo(() => {
    const items: Array<{ type: 'date' | 'message'; data: any; id: string }> = [];
    
    messages.forEach((message, index) => {
      // 日付区切りを追加
      if (index === 0 || !isSameDay(message.timestamp, messages[index - 1].timestamp)) {
        items.push({
          type: 'date',
          data: message.timestamp,
          id: `date-${message.timestamp.toISOString()}`
        });
      }
      
      // メッセージを追加
      items.push({
        type: 'message',
        data: message,
        id: message.id
      });
    });
    
    return items;
  }, [messages]);

  /**
   * 新しいメッセージが追加されたときに自動スクロール
   */
  useEffect(() => {
    if (scrollRef.current && messageItems.length > 0) {
      // 最下部にスクロール
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageItems.length]);

  return (
    <div 
      ref={scrollRef}
      className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden",
        "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
        className
      )}
    >
      {messageItems.length === 0 ? (
        // 空の状態表示
        <div className="flex items-center justify-center h-full p-4">
          <div className="text-center text-muted-foreground">
            <div className="text-lg mb-2">💬</div>
            <p className="text-sm">まだメッセージがありません</p>
            <p className="text-xs opacity-70 mt-1">
              メッセージを送信して会話を始めましょう
            </p>
          </div>
        </div>
      ) : (
        // メッセージリスト表示（仮想化なし）
        <div className="p-4 space-y-2">
          {messageItems.map((item) => (
            <div key={item.id}>
              {item.type === 'date' ? (
                // 日付区切り表示
                <div className="flex justify-center my-4">
                  <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                    {formatDateSeparator(item.data)}
                  </div>
                </div>
              ) : (
                // メッセージ表示
                <MessageBubble message={item.data} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 同じ日かどうかを判定
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * 日付区切り用のフォーマット
 */
function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) {
    return '今日';
  } else if (isSameDay(date, yesterday)) {
    return '昨日';
  } else {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}