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
  const internalRef = React.useRef<HTMLDivElement>(null);

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

  // forwardedRefを適切に処理 - 遷移完了後に実際のMessageListを参照
  React.useImperativeHandle(forwardedRef, () => {
    // 遷移完了後は内部のMessageListのrefを返す
    if (shouldShowMessages && internalRef.current) {
      console.log('🎭 Returning actual MessageList ref:', {
        hasInternalRef: !!internalRef.current,
        scrollHeight: internalRef.current.scrollHeight,
        clientHeight: internalRef.current.clientHeight,
        tagName: internalRef.current.tagName
      });
      return internalRef.current;
    }
    
    // 遷移中または表示前は、外側のコンテナ要素を返す
    const containerElement = document.querySelector('[data-transition-controlled="true"]') as HTMLDivElement;
    if (containerElement) {
      console.log('🎭 Returning container element during transition');
      
      // コンテナ要素にscrollToBottomメソッドを追加
      (containerElement as any).scrollToBottom = () => {
        console.log('🎭 Transition: scrollToBottom called during transition - will retry after transition');
        // 遷移完了後にリトライ
        setTimeout(() => {
          if (internalRef.current && typeof (internalRef.current as any).scrollToBottom === 'function') {
            (internalRef.current as any).scrollToBottom(true);
          }
        }, 300);
      };
      
      return containerElement;
    }
    
    // フォールバック: 空のダミー要素
    const dummyElement = document.createElement('div');
    dummyElement.style.height = '0px';
    dummyElement.style.overflow = 'hidden';
    
    (dummyElement as any).scrollToBottom = () => {
      console.log('🎭 Dummy: scrollToBottom called on dummy element');
    };
    
    return dummyElement;
  }, [shouldShowMessages]);

  // 遷移完了後にスクロール状態を再チェック
  React.useEffect(() => {
    if (shouldShowMessages && internalRef.current) {
      console.log('🎭 Transition completed, triggering scroll check');
      
      // 遷移完了後に少し遅延してスクロール状態をチェック
      const recheckScroll = () => {
        if (onScrollToBottom) {
          // 親コンポーネントにスクロール状態の再チェックを促す
          setTimeout(() => {
            console.log('🎭 Triggering scroll recheck after transition');
            // ダミーのスクロールイベントを発火してスクロールボタンの状態を更新
            const scrollEvent = new Event('scroll');
            if (internalRef.current) {
              internalRef.current.dispatchEvent(scrollEvent);
            }
          }, 100);
        }
      };
      
      recheckScroll();
      setTimeout(recheckScroll, 200);
      setTimeout(recheckScroll, 500);
    }
  }, [shouldShowMessages, onScrollToBottom]);

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
            ref={internalRef}
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