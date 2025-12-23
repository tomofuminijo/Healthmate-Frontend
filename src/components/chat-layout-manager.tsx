import React, { useState, useEffect, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

interface ChatLayoutManagerProps {
  hasMessages: boolean;
  children: React.ReactNode;
  className?: string;
}

interface LayoutState {
  mode: 'empty' | 'active';
  isTransitioning: boolean;
}

interface ChatLayoutContextType {
  layoutState: LayoutState;
  isEmptyMode: boolean;
  isActiveMode: boolean;
  isTransitioning: boolean;
  prefersReducedMotion: boolean;
}

// レイアウト状態を子コンポーネントに提供するContext
const ChatLayoutContext = createContext<ChatLayoutContextType | null>(null);

/**
 * モーション軽減設定を検出するカスタムフック
 */
const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // CSS media queryでモーション軽減設定を検出
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // 初期値を設定
    setPrefersReducedMotion(mediaQuery.matches);
    
    // 設定変更を監視
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      console.log('🎭 Motion preference changed:', e.matches ? 'reduced' : 'normal');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
};

/**
 * ChatLayoutManager コンポーネント
 * チャットのレイアウト状態（空チャット状態 ↔ アクティブチャット状態）を管理し、
 * 遷移アニメーションを制御する中央管理コンポーネント
 * アクセシビリティ対応: モーション軽減設定への対応
 */
export const ChatLayoutManager: React.FC<ChatLayoutManagerProps> = ({ 
  hasMessages, 
  children, 
  className 
}) => {
  const [layoutState, setLayoutState] = useState<LayoutState>({
    mode: hasMessages ? 'active' : 'empty',
    isTransitioning: false
  });
  
  const prefersReducedMotion = usePrefersReducedMotion();

  // メッセージ有無の変化を監視してレイアウト遷移
  useEffect(() => {
    const newMode = hasMessages ? 'active' : 'empty';
    
    if (newMode !== layoutState.mode) {
      console.log(`🔄 Layout transition: ${layoutState.mode} → ${newMode}`, {
        prefersReducedMotion
      });
      
      // モーション軽減設定の場合は即座に遷移
      if (prefersReducedMotion) {
        setLayoutState({ 
          mode: newMode, 
          isTransitioning: false 
        });
        console.log(`✅ Layout transition completed immediately (reduced motion): ${newMode}`);
        return;
      }
      
      // 通常のアニメーション遷移
      setLayoutState(prev => ({ 
        ...prev, 
        isTransitioning: true 
      }));
      
      // 遷移アニメーション後に状態更新（300ms）
      const transitionTimeout = setTimeout(() => {
        setLayoutState({ 
          mode: newMode, 
          isTransitioning: false 
        });
        console.log(`✅ Layout transition completed: ${newMode}`);
      }, 300);

      return () => clearTimeout(transitionTimeout);
    }
  }, [hasMessages, layoutState.mode, prefersReducedMotion]);

  // Context値を作成
  const contextValue: ChatLayoutContextType = {
    layoutState,
    isEmptyMode: layoutState.mode === 'empty',
    isActiveMode: layoutState.mode === 'active',
    isTransitioning: layoutState.isTransitioning,
    prefersReducedMotion
  };

  return (
    <ChatLayoutContext.Provider value={contextValue}>
      <div 
        className={cn(
          "chat-layout-container",
          // アニメーション: モーション軽減設定に対応
          !prefersReducedMotion && "transition-all duration-300 ease-in-out",
          prefersReducedMotion && "transition-none", // モーション軽減時はアニメーション無効
          // 空チャット状態: 画面全体を使って中央配置
          layoutState.mode === 'empty' && [
            "flex items-center justify-center min-h-screen",
            "bg-background"
          ],
          // アクティブチャット状態: フレックスカラムで上下配置
          layoutState.mode === 'active' && [
            "flex flex-col h-screen",
            "bg-background"
          ],
          // 遷移中はポインターイベントを無効化（モーション軽減時は除く）
          layoutState.isTransitioning && !prefersReducedMotion && "pointer-events-none",
          className
        )}
        data-layout-mode={layoutState.mode}
        data-transitioning={layoutState.isTransitioning}
        data-reduced-motion={prefersReducedMotion}
      >
        {children}
      </div>
    </ChatLayoutContext.Provider>
  );
};

/**
 * ChatLayoutContextを使用するためのカスタムフック
 * 子コンポーネントがレイアウト状態にアクセスできるようにする
 */
export const useChatLayout = (): ChatLayoutContextType => {
  const context = useContext(ChatLayoutContext);
  
  if (!context) {
    throw new Error('useChatLayout must be used within a ChatLayoutManager');
  }
  
  return context;
};

/**
 * レイアウトモードに応じたコンテナコンポーネント
 * チャット表示エリアの中央寄せとレスポンシブ対応
 * ChatGPTライクな中央寄せレイアウトを実現
 */
export const ChatContentContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const { isEmptyMode, isActiveMode } = useChatLayout();

  return (
    <div
      className={cn(
        // 基本的な中央寄せとレスポンシブ対応
        "w-full mx-auto",
        // 画面サイズに応じた最大幅制御（ChatGPTライク）
        "max-w-3xl", // デスクトップ: ChatGPTと同様の幅
        // レスポンシブパディング
        "px-4", // モバイル: 基本パディング
        "sm:px-6", // タブレット: 少し広く
        "md:px-8", // デスクトップ: さらに広く
        "lg:px-4", // 大画面: 中央寄せを強調するため控えめに
        // 空チャット状態: 中央配置用の調整
        isEmptyMode && [
          "max-w-2xl", // 空チャット時はより狭く（入力フォーカス）
          "w-full"
        ],
        // アクティブチャット状態: フル幅利用
        isActiveMode && [
          "flex-1", // 利用可能な高さを全て使用
          "flex flex-col"
        ],
        className
      )}
    >
      {children}
    </div>
  );
};