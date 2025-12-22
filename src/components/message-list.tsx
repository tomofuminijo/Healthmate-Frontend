import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
 * 大量メッセージ対応のため仮想化を実装
 */
export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  className 
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

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

  // 仮想化の設定
  const virtualizer = useVirtualizer({
    count: messageItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = messageItems[index];
      // 日付区切りは小さく、メッセージは大きめに見積もる
      return item.type === 'date' ? 40 : 120;
    },
    overscan: 5, // 画面外の要素も5個分レンダリング
  });

  /**
   * 新しいメッセージが追加されたときに自動スクロール
   */
  useEffect(() => {
    if (shouldAutoScrollRef.current && messageItems.length > 0) {
      // 最後の要素にスクロール
      virtualizer.scrollToIndex(messageItems.length - 1, {
        align: 'end',
        behavior: 'smooth',
      });
    }
  }, [messageItems.length, virtualizer]);

  /**
   * スクロール位置を監視して自動スクロールを制御
   */
  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      shouldAutoScrollRef.current = isNearBottom;
    };

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      ref={parentRef}
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
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = messageItems[virtualItem.index];
            
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {item.type === 'date' ? (
                  // 日付区切り表示
                  <div className="flex justify-center my-4">
                    <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                      {formatDateSeparator(item.data)}
                    </div>
                  </div>
                ) : (
                  // メッセージ表示
                  <div className="px-4 py-2">
                    <MessageBubble message={item.data} />
                  </div>
                )}
              </div>
            );
          })}
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