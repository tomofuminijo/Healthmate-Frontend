import React from 'react';
import { Message } from '@/types/chat';
import { MessageList } from './message-list';
import { useChatLayout } from './chat-layout-manager';
import { cn } from '@/lib/utils';

interface MessageListWithTransitionControlProps {
  messages: Message[];
  className?: string;
  onScrollToBottom?: () => void;
  scrollBehavior?: 'auto' | 'user-only' | 'ai-only';
}

/**
 * MessageListWithTransitionControl コンポーネント
 * レイアウト遷移完了まで表示を制御するMessageListのラッパー
 * 
 * 解決する問題:
 * - メッセージが真ん中に表示される問題
 * - レイアウト遷移中の位置不安定問題
 * 
 * 動作:
 * 1. レイアウト遷移中は非表示（条件付きレンダリング）
 * 2. 遷移完了後に表示（フェードイン効果付き）
 * 3. スクロール制御は遷移完了後に実行
 */
export const MessageListWithTransitionControl = React.forwardRef<
  HTMLDivElement, 
  MessageListWithTransitionControlProps
>(({ messages, className, onScrollToBottom, scrollBehavior = 'auto' }, forwardedRef) => {
  const { isTransitioning, isActiveMode, prefersReducedMotion } = useChatLayout();

  // デバッグログ
  console.log('🎭 MessageListWithTransitionControl:', {
    isTransitioning,
    isActiveMode,
    prefersReducedMotion,
    messageCount: messages.length,
    shouldShow: !isTransitioning && isActiveMode
  });

  // レイアウト遷移完了後にのみ表示
  const shouldShowMessages = !isTransitioning && isActiveMode;

  return (
    <div 
      className={cn(
        "relative w-full h-full",
        className
      )}
      data-transition-controlled="true"
      data-should-show={shouldShowMessages}
    >
      {/* レイアウト遷移完了後にのみMessageListを表示 */}
      {shouldShowMessages && (
        <div
          className={cn(
            "w-full h-full",
            // フェードイン効果（モーション軽減設定に対応）
            !prefersReducedMotion && "animate-in fade-in duration-200",
            prefersReducedMotion && "opacity-100"
          )}
        >
          <MessageList
            ref={forwardedRef}
            messages={messages}
            className="w-full h-full"
            onScrollToBottom={onScrollToBottom}
            scrollBehavior={scrollBehavior}
          />
        </div>
      )}
      
      {/* レイアウト遷移中のローディング表示 */}
      {!shouldShowMessages && messages.length > 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center space-y-2">
            <div className={cn(
              "w-6 h-6 border-2 border-primary border-t-transparent rounded-full",
              !prefersReducedMotion && "animate-spin",
              prefersReducedMotion && "opacity-50"
            )} />
            <div className="text-muted-foreground text-sm">
              チャットを準備中...
            </div>
          </div>
        </div>
      )}
      
      {/* 空の状態（メッセージがない場合） */}
      {!shouldShowMessages && messages.length === 0 && (
        <div className="flex items-center justify-center h-full opacity-0">
          {/* 空の状態は非表示 */}
        </div>
      )}
    </div>
  );
});

MessageListWithTransitionControl.displayName = 'MessageListWithTransitionControl';