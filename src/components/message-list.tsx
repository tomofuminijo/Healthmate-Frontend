import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Message } from '@/types/chat';
import { MessageBubble } from './message-bubble';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: Message[];
  className?: string;
  // スクロール制御用の新しいプロパティ
  onScrollToBottom?: () => void; // 最下部スクロール時のコールバック
  scrollBehavior?: 'auto' | 'user-only' | 'ai-only'; // スクロール動作制御
}

/**
 * MessageList コンポーネント
 * チャット履歴の表示とスクロール管理を行う
 * ユーザーメッセージ送信時の上部表示スクロールとAIレスポンス時の非オートスクロール対応
 */
export const MessageList = React.forwardRef<HTMLDivElement, MessageListProps>(({ 
  messages, 
  className,
  onScrollToBottom,
  scrollBehavior = 'auto'
}, forwardedRef) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // forwardedRefとscrollRefを統合し、scrollToBottomメソッドを公開
  React.useImperativeHandle(forwardedRef, () => {
    const element = scrollRef.current;
    if (!element) {
      // nullを返すのではなく、ダミーのHTMLDivElementを返す
      const dummy = document.createElement('div');
      return Object.assign(dummy, {
        scrollToBottom: () => {}
      });
    }
    
    // DOM要素のプロパティとメソッドをコピーし、カスタムメソッドを追加
    return Object.assign(element, {
      scrollToBottom: (smooth: boolean = true) => {
        if (messagesEndRef.current) {
          const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          
          // 直接最大スクロール位置に移動
          setTimeout(() => {
            // 実際のスクロール可能な要素を見つける
            let scrollableElement: HTMLElement = element;
            let parent = element.parentElement;
            
            while (parent && parent !== document.body) {
              if (parent.scrollHeight > parent.clientHeight) {
                const style = window.getComputedStyle(parent);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                  scrollableElement = parent;
                  break;
                }
              }
              parent = parent.parentElement;
            }
            
            // 要素レベルでの最大スクロール
            const maxScrollTop = scrollableElement.scrollHeight - scrollableElement.clientHeight;
            if (maxScrollTop > 0) {
              if (smooth && !prefersReducedMotion) {
                scrollableElement.scrollTo({
                  top: maxScrollTop,
                  behavior: 'smooth'
                });
              } else {
                scrollableElement.scrollTop = maxScrollTop;
              }
            }
            
            // ページレベルでの最大スクロール
            const maxPageScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (maxPageScroll > window.scrollY) {
              if (smooth && !prefersReducedMotion) {
                window.scrollTo({
                  top: maxPageScroll,
                  behavior: 'smooth'
                });
              } else {
                window.scrollTo(0, maxPageScroll);
              }
            }
            
          }, 50);
          
          // コールバック実行
          if (onScrollToBottom) {
            onScrollToBottom();
          }
        }
      }
    });
  }, [onScrollToBottom]); // scrollToBottomを依存配列から削除
  
  // スクロール制御用の状態
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(null);

  // デバッグログ
  console.log('MessageList render:', { messageCount: messages.length });

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
   * スクロール位置の監視
   */
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px以内を最下部とみなす
    
    setIsAtBottom(isNearBottom);
    
    // ユーザーが手動でスクロールしているかを検出
    if (!isNearBottom) {
      setIsUserScrolling(true);
      
      // スクロール停止を検出するためのタイマー
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      const timeout = setTimeout(() => {
        setIsUserScrolling(false);
      }, 1000); // 1秒間スクロールが停止したら手動スクロール終了とみなす
      
      setScrollTimeout(timeout);
    } else {
      setIsUserScrolling(false);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        setScrollTimeout(null);
      }
    }
  }, [scrollTimeout]);

  /**
   * ユーザーメッセージを上部に表示するスクロール（要件6対応）
   * アクセシビリティ対応: モーション軽減設定への対応
   */
  const scrollToUserMessage = useCallback((messageId: string) => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement && scrollRef.current) {
      console.log('👤 Scrolling to user message:', messageId);
      
      // モーション軽減設定を確認
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      messageElement.scrollIntoView({ 
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start' // メッセージを上部に表示
      });
    }
  }, []);

  /**
   * 最下部への確実なスクロール
   * アクセシビリティ対応: モーション軽減設定への対応
   */
  const scrollToBottom = useCallback((smooth: boolean = true) => {
    if (messagesEndRef.current) {
      // モーション軽減設定を確認
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const shouldUseSmooth = smooth && !prefersReducedMotion;
      
      messagesEndRef.current.scrollIntoView({ 
        behavior: shouldUseSmooth ? 'smooth' : 'auto',
        block: 'end'
      });
      console.log('🔽 Scrolled to bottom:', shouldUseSmooth ? 'smooth' : 'instant');
      
      // コールバック実行
      if (onScrollToBottom) {
        onScrollToBottom();
      }
    }
  }, [onScrollToBottom]);

  /**
   * ユーザーメッセージ送信時のスクロール制御（要件6対応）
   */
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    // ユーザーメッセージの場合
    if (lastMessage?.role === 'user' && lastMessage.id !== lastUserMessageId) {
      setLastUserMessageId(lastMessage.id);
      
      // 200ms以内でスムーズにスクロール（要件6.3）
      setTimeout(() => {
        scrollToUserMessage(lastMessage.id);
      }, 50); // DOM更新を待つ
    }
  }, [messages, lastUserMessageId, scrollToUserMessage]);

  /**
   * AIレスポンス時の非オートスクロール制御（要件7対応）
   */
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    // AIメッセージの場合は自動スクロールしない（要件7.1）
    if (lastMessage?.role === 'assistant') {
      // スクロール位置を維持（要件7.3, 7.4）
      return;
    }
  }, [messages]);

  /**
   * スクロール動作の制御
   */
  useEffect(() => {
    if (scrollBehavior === 'user-only') {
      // ユーザーメッセージのみスクロール
      return;
    }
    
    if (scrollBehavior === 'ai-only') {
      // AIメッセージのみスクロール（通常は使用しない）
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant' && isAtBottom) {
        scrollToBottom();
      }
      return;
    }
    
    // autoモード: 従来の動作（最下部にいる場合のみ自動スクロール）
    if (scrollBehavior === 'auto' && isAtBottom && !isUserScrolling) {
      scrollToBottom();
    }
  }, [messages, scrollBehavior, isAtBottom, isUserScrolling, scrollToBottom]);

  // スクロールイベントリスナーの設定
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [handleScroll, scrollTimeout]);

  return (
    <div 
      ref={scrollRef}
      className={cn(
        "h-full overflow-y-auto overflow-x-hidden",
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
        // メッセージリスト表示
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
                <div data-message-id={item.data.id}>
                  <MessageBubble message={item.data} />
                </div>
              )}
            </div>
          ))}
          {/* 自動スクロール用の要素 */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      )}
    </div>
  );
});

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
MessageList.displayName = 'MessageList';