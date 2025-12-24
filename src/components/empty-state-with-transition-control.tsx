import React from 'react';
import { MessageInput } from './message-input';
import { ChatContentContainer, useChatLayout } from './chat-layout-manager';
import { cn } from '@/lib/utils';

interface EmptyStateWithTransitionControlProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled: boolean;
  placeholder: string;
  className?: string;
}

/**
 * EmptyStateWithTransitionControl コンポーネント
 * レイアウト遷移完了まで表示を制御する空チャット状態のラッパー
 * 
 * 解決する問題:
 * - 初期画面が画面最上部に表示される問題
 * - レイアウト遷移中の位置不安定問題
 * 
 * 動作:
 * 1. レイアウト遷移中は非表示（条件付きレンダリング）
 * 2. 遷移完了後に表示（フェードイン効果付き）
 * 3. empty モードでのみ表示
 */
export const EmptyStateWithTransitionControl: React.FC<EmptyStateWithTransitionControlProps> = ({
  onSendMessage,
  isLoading,
  disabled,
  placeholder,
  className
}) => {
  const { isTransitioning, isEmptyMode, prefersReducedMotion } = useChatLayout();

  // デバッグログ
  console.log('🏠 EmptyStateWithTransitionControl:', {
    isTransitioning,
    isEmptyMode,
    prefersReducedMotion,
    shouldShow: !isTransitioning && isEmptyMode
  });

  // レイアウト遷移完了後かつ空モードでのみ表示
  const shouldShowEmptyState = !isTransitioning && isEmptyMode;

  return (
    <div 
      className={cn(
        "relative w-full h-full",
        className
      )}
      data-empty-state-controlled="true"
      data-should-show={shouldShowEmptyState}
    >
      {/* レイアウト遷移完了後にのみ空チャット状態を表示 */}
      {shouldShowEmptyState && (
        <div
          className={cn(
            "w-full h-full",
            // フェードイン効果（モーション軽減設定に対応）
            !prefersReducedMotion && "animate-in fade-in duration-300",
            prefersReducedMotion && "opacity-100"
          )}
        >
          <ChatContentContainer className="flex items-center justify-center min-h-0 -mt-48">
            <div className="w-full max-w-2xl">
              {/* ウェルカムメッセージ */}
              <div className="text-center mb-8">
                <div className="text-4xl mb-4">🏥</div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Healthmate AI コーチ
                </h1>
                <p className="text-muted-foreground">
                  Healthmate に相談してください。パーソナライズされたアドバイスを提供します。
                </p>
              </div>
              
              {/* 中央配置のメッセージ入力 */}
              <MessageInput
                onSendMessage={onSendMessage}
                isLoading={isLoading}
                disabled={disabled}
                placeholder={placeholder}
                layoutMode="empty"
                className="rounded-xl"
              />
            </div>
          </ChatContentContainer>
        </div>
      )}
      
      {/* レイアウト遷移中のローディング表示 */}
      {!shouldShowEmptyState && isEmptyMode && (
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
    </div>
  );
};