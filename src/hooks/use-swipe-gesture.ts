import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // スワイプと判定する最小距離（px）
  restraint?: number; // 垂直方向の許容範囲（px）
  allowedTime?: number; // スワイプと判定する最大時間（ms）
}

/**
 * スワイプジェスチャーを検出するカスタムフック
 * モバイル端末でのタッチジェスチャーに対応
 */
export const useSwipeGesture = (options: SwipeGestureOptions = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 100, // 100px以上のスワイプで反応
    restraint = 100, // 垂直方向100px以内
    allowedTime = 300 // 300ms以内
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const startTouch = touchStartRef.current;
      
      const distX = touch.clientX - startTouch.x;
      const distY = touch.clientY - startTouch.y;
      const elapsedTime = Date.now() - startTouch.time;

      // スワイプ判定条件
      const isValidSwipe = 
        elapsedTime <= allowedTime && // 時間内
        Math.abs(distX) >= threshold && // 水平距離が閾値以上
        Math.abs(distY) <= restraint; // 垂直距離が許容範囲内

      if (isValidSwipe) {
        if (distX > 0 && onSwipeRight) {
          // 右スワイプ（左から右へ）
          onSwipeRight();
        } else if (distX < 0 && onSwipeLeft) {
          // 左スワイプ（右から左へ）
          onSwipeLeft();
        }
      }

      touchStartRef.current = null;
    };

    const handleTouchCancel = () => {
      touchStartRef.current = null;
    };

    // パッシブリスナーでパフォーマンス向上
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, restraint, allowedTime]);
};

/**
 * 画面端からのスワイプを検出するカスタムフック
 * 画面左端からのスワイプでサイドバーを開く用途に特化
 */
export const useEdgeSwipeGesture = (options: {
  onEdgeSwipeRight?: () => void;
  edgeThreshold?: number; // 画面端からの距離（px）
  swipeThreshold?: number; // スワイプ距離の閾値（px）
}) => {
  const {
    onEdgeSwipeRight,
    edgeThreshold = 20, // 画面左端20px以内
    swipeThreshold = 100 // 100px以上のスワイプ
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      
      // 画面左端からのタッチのみ検出
      if (touch.clientX <= edgeThreshold) {
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now()
        };
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const startTouch = touchStartRef.current;
      
      const distX = touch.clientX - startTouch.x;
      const distY = touch.clientY - startTouch.y;
      const elapsedTime = Date.now() - startTouch.time;

      // 右スワイプ判定（画面端から右へ）
      const isValidEdgeSwipe = 
        elapsedTime <= 300 && // 300ms以内
        distX >= swipeThreshold && // 右方向に閾値以上
        Math.abs(distY) <= 100; // 垂直方向100px以内

      if (isValidEdgeSwipe && onEdgeSwipeRight) {
        logger.debug('🖐️ Edge swipe detected:', { distX, distY, elapsedTime });
        onEdgeSwipeRight();
      }

      touchStartRef.current = null;
    };

    const handleTouchCancel = () => {
      touchStartRef.current = null;
    };

    // パッシブリスナーでパフォーマンス向上
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [onEdgeSwipeRight, edgeThreshold, swipeThreshold]);
};