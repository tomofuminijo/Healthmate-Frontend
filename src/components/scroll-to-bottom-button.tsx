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
    console.log('⬇️ Scroll to bottom button clicked');
    onClick();
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      className={cn(
        // 基本スタイル
        "fixed z-10",
        "bg-primary text-primary-foreground",
        "rounded-full p-2 shadow-lg",
        "border border-primary/20",
        
        // アニメーション: モーション軽減設定に対応
        !prefersReducedMotion && [
          "hover:bg-primary/90 transition-all duration-200",
          "animate-in fade-in slide-in-from-bottom-2 duration-300"
        ],
        prefersReducedMotion && [
          "hover:bg-primary/90", // ホバー効果は残す（瞬間的）
          // アニメーションは無効化
        ],
        
        // 位置: チャット入力エリアの上（要件8.1）- 固定入力欄を考慮
        "bottom-28 left-1/2 transform -translate-x-1/2",
        
        // レスポンシブ対応
        "sm:bottom-32", // デスクトップでは少し上に
        
        className
      )}
      aria-label="チャット最下部に移動"
      title="最新のメッセージに移動"
    >
      {/* 下向き矢印アイコン（要件8.4） */}
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

  // スクロール位置の監視
  React.useEffect(() => {
    const scrollElement = scrollContainerRef.current;
    if (!scrollElement || !hasMessages) {
      setIsVisible(false);
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px以内を最下部とみなす
      
      // 最下部にいない場合のみボタンを表示（要件8.3）
      setIsVisible(!isNearBottom);
    };

    // 初期状態をチェック
    handleScroll();

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainerRef, hasMessages]);

  const handleScrollToBottom = () => {
    const scrollElement = scrollContainerRef.current;
    if (!scrollElement) return;

    // モーション軽減設定を確認
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 300ms以内でスムーズにスクロール（要件8.5）
    // モーション軽減設定の場合は即座にスクロール
    scrollElement.scrollTo({
      top: scrollElement.scrollHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });

    console.log('⬇️ Scrolled to bottom:', prefersReducedMotion ? 'instant' : 'smooth');

    // コールバック実行
    onScrollToBottom();
  };

  return (
    <ScrollToBottomButton
      isVisible={isVisible && hasMessages}
      onClick={handleScrollToBottom}
      className={className}
    />
  );
};