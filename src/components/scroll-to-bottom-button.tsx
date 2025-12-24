import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollToBottomButtonProps {
  isVisible: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * モーション軽減設定を検出するカスタムフック（独立版）
 */
const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

interface ScrollToBottomButtonProps {
  isVisible: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * ScrollToBottomButton コンポーネント
 * チャット最下部への移動機能を提供（要件8対応）
 * アクセシビリティ対応: モーション軽減設定への対応
 */
export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  isVisible,
  onClick,
  className
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (!isVisible) return null;

  const handleClick = () => {
    onClick();
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="secondary"
      className={cn(
        // 基本スタイル - ChatGPTライクな丸いボタン
        "fixed z-50", // z-indexを上げる
        "w-8 h-8 p-0", // 小さな正円
        "bg-background text-foreground",
        "rounded-full shadow-md border border-border",
        
        // アニメーション: モーション軽減設定に対応
        !prefersReducedMotion && [
          "hover:bg-muted transition-all duration-200",
          "animate-in fade-in slide-in-from-bottom-2 duration-300"
        ],
        prefersReducedMotion && [
          "hover:bg-muted", // ホバー効果は残す（瞬間的）
          // アニメーションは無効化
        ],
        
        // 位置: チャット入力エリアの上 - ChatGPTライクな位置
        "bottom-28 right-4", // 右下に配置
        
        // レスポンシブ対応
        "sm:bottom-32 sm:right-6", // デスクトップでは少し上に、右側に余裕
        
        className
      )}
      aria-label="チャット最下部に移動"
      title="最新のメッセージに移動"
    >
      {/* 下向き矢印アイコン - ChatGPTライク */}
      <ChevronDown className="h-4 w-4" />
    </Button>
  );
};

/**
 * ScrollToBottomButtonContainer コンポーネント
 * スクロール位置を監視してボタンの表示/非表示を制御
 */
interface ScrollToBottomButtonContainerProps {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  hasMessages: boolean;
  onScrollToBottom: () => void;
  className?: string;
}

export const ScrollToBottomButtonContainer: React.FC<ScrollToBottomButtonContainerProps> = ({
  scrollContainerRef,
  hasMessages,
  onScrollToBottom,
  className
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [forceVisible, setForceVisible] = React.useState(false);

  // デバッグ用: DOM構造調査機能
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+S でスクロールボタンを強制表示/非表示
      if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        setForceVisible(prev => {
          console.log('🔧 Debug: Force visible toggled:', !prev);
          return !prev;
        });
      }
      
      // Ctrl+Shift+D でDOM構造を調査
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        const scrollElement = scrollContainerRef.current;
        if (scrollElement) {
          console.log('🔍 DOM Investigation:', {
            element: scrollElement,
            tagName: scrollElement.tagName,
            className: scrollElement.className,
            id: scrollElement.id,
            scrollHeight: scrollElement.scrollHeight,
            clientHeight: scrollElement.clientHeight,
            offsetHeight: scrollElement.offsetHeight,
            getBoundingClientRect: scrollElement.getBoundingClientRect(),
            computedStyle: window.getComputedStyle(scrollElement),
            parent: scrollElement.parentElement,
            children: Array.from(scrollElement.children).map(child => ({
              tagName: child.tagName,
              className: child.className,
              scrollHeight: (child as HTMLElement).scrollHeight,
              clientHeight: (child as HTMLElement).clientHeight
            }))
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollContainerRef]);

  // 遷移完了の検出と再チェック
  React.useEffect(() => {
    const scrollElement = scrollContainerRef.current;
    
    if (!scrollElement || !hasMessages) {
      return;
    }
    
    // 遷移完了を検出するためのMutationObserver
    let transitionObserver: MutationObserver | null = null;
    
    if (window.MutationObserver) {
      transitionObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'data-should-show') {
            const target = mutation.target as HTMLElement;
            const shouldShow = target.getAttribute('data-should-show') === 'true';
            
            if (shouldShow) {
              console.log('🎭 Transition completion detected, rechecking scroll');
              
              // 遷移完了後にスクロール状態を再チェック
              setTimeout(() => {
                const actualScrollElement = scrollContainerRef.current;
                if (actualScrollElement && typeof actualScrollElement.addEventListener === 'function') {
                  const { scrollTop, scrollHeight, clientHeight } = actualScrollElement;
                  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
                  const isScrollable = scrollHeight > clientHeight;
                  const isNearBottom = distanceFromBottom <= 100;
                  const shouldShowButton = isScrollable && !isNearBottom;
                  
                  console.log('🎭 Post-transition scroll check:', {
                    scrollTop,
                    scrollHeight,
                    clientHeight,
                    distanceFromBottom,
                    isScrollable,
                    isNearBottom,
                    shouldShowButton
                  });
                  
                  setIsVisible(shouldShowButton);
                }
              }, 100);
            }
          }
        });
      });
      
      // data-transition-controlled要素を監視
      const transitionElement = document.querySelector('[data-transition-controlled="true"]');
      if (transitionElement) {
        transitionObserver.observe(transitionElement, {
          attributes: true,
          attributeFilter: ['data-should-show']
        });
      }
    }
    
    return () => {
      if (transitionObserver) {
        transitionObserver.disconnect();
      }
    };
  }, [scrollContainerRef, hasMessages]);

  // hasMessagesが変更された時にもスクロール状態をチェック
  React.useEffect(() => {
    if (hasMessages && scrollContainerRef.current) {
      const checkAfterMessagesChange = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const scrollElement = scrollContainerRef.current;
            if (scrollElement && typeof scrollElement.addEventListener === 'function') {
              const { scrollTop, scrollHeight, clientHeight } = scrollElement;
              const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
              const isScrollable = scrollHeight > clientHeight;
              const isNearBottom = distanceFromBottom <= 100;
              const shouldShow = isScrollable && !isNearBottom;
              
              console.log('📊 Messages change check:', {
                hasMessages,
                scrollTop,
                scrollHeight,
                clientHeight,
                distanceFromBottom,
                isScrollable,
                isNearBottom,
                shouldShow
              });
              
              setIsVisible(shouldShow);
            }
          });
        });
      };
      
      // 即座にチェック
      checkAfterMessagesChange();
      
      // 少し遅延してもチェック
      setTimeout(checkAfterMessagesChange, 100);
      setTimeout(checkAfterMessagesChange, 300);
    }
  }, [hasMessages, scrollContainerRef]);

  // スクロール位置の監視
  React.useEffect(() => {
    const scrollElement = scrollContainerRef.current;
    
    console.log('📍 ScrollToBottomButtonContainer setup:', {
      hasScrollElement: !!scrollElement,
      hasMessages,
      scrollElementType: scrollElement?.constructor?.name,
      isRealDOMElement: scrollElement instanceof HTMLElement,
      hasAddEventListener: typeof scrollElement?.addEventListener === 'function',
      elementTagName: scrollElement?.tagName,
      elementClassName: scrollElement?.className
    });
    
    if (!scrollElement || !hasMessages) {
      console.log('❌ No scroll element or no messages:', { hasScrollElement: !!scrollElement, hasMessages });
      setIsVisible(false);
      return;
    }

    // DOM要素かどうかを確認
    if (typeof scrollElement.addEventListener !== 'function') {
      console.warn('❌ scrollElement is not a real DOM element');
      setIsVisible(false);
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // より正確なスクロール可能性の判定
      // 1. 基本的なスクロール可能性チェック
      const basicScrollable = scrollHeight > clientHeight;
      
      // 2. 実際の表示領域を考慮したチェック
      const rect = scrollElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const elementVisibleHeight = Math.min(rect.height, viewportHeight - rect.top);
      const contentOverflowsViewport = scrollHeight > elementVisibleHeight;
      
      // 3. 親要素の制約を考慮
      const parentElement = scrollElement.parentElement;
      const parentHeight = parentElement ? parentElement.clientHeight : 0;
      const contentOverflowsParent = scrollHeight > parentHeight;
      
      // 4. 実際のスクロールテスト
      const originalScrollTop = scrollElement.scrollTop;
      scrollElement.scrollTop = originalScrollTop + 1;
      const canActuallyScroll = scrollElement.scrollTop !== originalScrollTop;
      scrollElement.scrollTop = originalScrollTop; // 元に戻す
      
      // 5. ビューポートベースの判定（最も重要）
      const elementTooTallForViewport = rect.height > viewportHeight * 0.8; // ビューポートの80%以上の高さ
      
      // いずれかの条件でスクロール可能と判定（ビューポートベースを優先）
      const isScrollable = contentOverflowsViewport || elementTooTallForViewport || basicScrollable || contentOverflowsParent || canActuallyScroll;
      
      // 最下部判定の詳細ログ
      console.log('🔍 Bottom detection:', {
        scrollTop,
        scrollHeight,
        clientHeight,
        distanceFromBottom,
        isAtTop: scrollTop === 0,
        isAtBottom: distanceFromBottom <= 100,
        heightsEqual: scrollHeight === clientHeight
      });
      
      // 特別なケース: scrollHeight === clientHeight の場合
      // この場合、要素自体がコンテンツ全体の高さに拡張されているが、
      // 実際にはビューポートの制約でスクロールが必要
      let isNearBottom;
      if (scrollHeight === clientHeight && elementTooTallForViewport) {
        // 要素がビューポートより大きい場合は、常に最上部にいるとみなす
        isNearBottom = false;
        console.log('🔍 Special case: Element height equals scroll height but overflows viewport');
      } else {
        isNearBottom = distanceFromBottom <= 100;
      }
      
      // スクロール可能で、かつ最下部にいない場合にボタンを表示
      const shouldShow = isScrollable && !isNearBottom;
      
      // デバッグ情報を出力（分割して確実に表示）
      console.log('🔍 Scroll check - Part 1:', {
        scrollHeight,
        clientHeight,
        elementHeight: rect.height,
        viewportHeight
      });
      
      console.log('🔍 Scroll check - Part 2:', {
        elementTooTallForViewport,
        contentOverflowsViewport,
        basicScrollable,
        canActuallyScroll
      });
      
      console.log('🔍 Scroll check - Part 3:', {
        finalIsScrollable: isScrollable,
        isNearBottom,
        distanceFromBottom,
        shouldShow
      });
      
      setIsVisible(shouldShow);
    };

    // 初期状態をチェック
    const initialCheck = () => {
      // DOM更新を確実に待つ
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          handleScroll();
        });
      });
    };
    
    // 即座にチェック
    initialCheck();
    
    // 複数のタイミングでチェック（レイアウト完了後）
    const timer1 = setTimeout(initialCheck, 100);
    const timer2 = setTimeout(initialCheck, 300);
    const timer3 = setTimeout(initialCheck, 500);
    const timer4 = setTimeout(initialCheck, 1000); // さらに遅延してチェック
    
    // ResizeObserverでレイアウト変更を監視
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          handleScroll();
        });
      });
      resizeObserver.observe(scrollElement);
    }
    
    // MutationObserverでDOM変更を監視（メッセージ追加時など）
    if (window.MutationObserver) {
      mutationObserver = new MutationObserver(() => {
        requestAnimationFrame(() => {
          handleScroll();
        });
      });
      mutationObserver.observe(scrollElement, {
        childList: true,
        subtree: true,
        attributes: false
      });
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (typeof scrollElement.removeEventListener === 'function') {
        scrollElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [scrollContainerRef, hasMessages]);

  const handleScrollToBottom = () => {
    const scrollElement = scrollContainerRef.current;
    
    console.log('🔍 Scroll element details:', {
      hasScrollElement: !!scrollElement,
      scrollElement,
      scrollTop: scrollElement?.scrollTop,
      scrollHeight: scrollElement?.scrollHeight,
      clientHeight: scrollElement?.clientHeight,
      tagName: scrollElement?.tagName,
      className: scrollElement?.className,
      hasScrollToBottomMethod: typeof (scrollElement as any)?.scrollToBottom === 'function'
    });
    
    if (!scrollElement) {
      console.warn('❌ No scroll element found');
      return;
    }

    // MessageListのscrollToBottomメソッドを直接呼び出し
    if (typeof (scrollElement as any).scrollToBottom === 'function') {
      console.log('🎯 Calling MessageList.scrollToBottom method');
      (scrollElement as any).scrollToBottom(true);
      onScrollToBottom();
      return;
    }

    // フォールバック: 従来の方法
    console.log('🔄 Using fallback scroll method');
    
    // モーション軽減設定を確認
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    try {
      // 最大スクロール位置を計算（入力欄の高さを考慮して余分にスクロール）
      const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
      const extraScroll = 150; // 入力欄の高さ分を考慮
      const targetScrollTop = maxScrollTop + extraScroll;
      
      // 方法1: scrollTo
      scrollElement.scrollTo({
        top: targetScrollTop,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      
      console.log('✅ Method 1 (scrollTo) executed with target:', targetScrollTop);
      
      // 方法2: scrollTopを直接設定（確実にするため）
      setTimeout(() => {
        scrollElement.scrollTop = targetScrollTop;
        console.log('✅ Method 2 (scrollTop) executed as confirmation');
      }, prefersReducedMotion ? 50 : 300);
      
    } catch (error) {
      console.error('❌ Scroll error:', error);
      // 最後の手段：scrollTopを直接設定
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }

    console.log('⬇️ Scrolled to bottom:', prefersReducedMotion ? 'instant' : 'smooth');

    // コールバック実行
    onScrollToBottom();
  };

  return (
    <ScrollToBottomButton
      isVisible={isVisible || forceVisible}
      onClick={handleScrollToBottom}
      className={className}
    />
  );
};