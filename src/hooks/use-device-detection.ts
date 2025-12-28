import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * デバイスタイプを検出するカスタムフック
 * モバイルとデスクトップで異なるUI動作を実現
 */
export const useDeviceDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      // タッチデバイスの検出
      const hasTouchScreen = 'ontouchstart' in window || 
                            navigator.maxTouchPoints > 0 || 
                            (navigator as any).msMaxTouchPoints > 0;

      // 画面サイズによるモバイル判定
      const isMobileScreen = window.innerWidth < 768; // md breakpoint

      // User Agentによるモバイル判定（補助的）
      const mobileUserAgents = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileUserAgent = mobileUserAgents.test(navigator.userAgent);

      // 総合的な判定
      const isMobileDevice = isMobileScreen || (hasTouchScreen && isMobileUserAgent);

      setIsMobile(isMobileDevice);
      setIsTouchDevice(hasTouchScreen);

      logger.debug('📱 Device detection:', {
        isMobile: isMobileDevice,
        isTouchDevice: hasTouchScreen,
        screenWidth: window.innerWidth,
        userAgent: navigator.userAgent.substring(0, 50) + '...'
      });
    };

    // 初回チェック
    checkDevice();

    // リサイズ時の再チェック
    window.addEventListener('resize', checkDevice);
    
    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  return {
    isMobile,
    isTouchDevice,
    isDesktop: !isMobile
  };
};