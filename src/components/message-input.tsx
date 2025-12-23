import React, { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Send, Loader2 } from 'lucide-react';
import { useChatLayout } from './chat-layout-manager';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  // レイアウト制御用の新しいプロパティ
  layoutMode?: 'empty' | 'active' | 'auto'; // 'auto'は自動判定
  isTransitioning?: boolean;
}

/**
 * MessageInput コンポーネント
 * メッセージ入力フォームとキーボードショートカット対応
 * 日本語入力（IME）対応
 * レイアウトモードに応じた位置制御とアニメーション遷移対応
 */
export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isLoading = false,
  disabled = false,
  placeholder = "メッセージを入力してください...",
  className,
  layoutMode = 'auto',
  isTransitioning = false
}) => {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false); // IME変換中フラグ
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ChatLayoutManagerからレイアウト状態を取得（autoモードの場合）
  let chatLayoutContext = null;
  try {
    chatLayoutContext = useChatLayout();
  } catch {
    // ChatLayoutManager外で使用される場合は無視
  }

  // 実際のレイアウトモードを決定
  const actualLayoutMode = layoutMode === 'auto' && chatLayoutContext 
    ? chatLayoutContext.layoutState.mode 
    : layoutMode === 'auto' 
    ? 'active' // デフォルト
    : layoutMode;

  const actualIsTransitioning = isTransitioning || (chatLayoutContext?.isTransitioning ?? false);
  const prefersReducedMotion = chatLayoutContext?.prefersReducedMotion ?? false;

  /**
   * メッセージ送信処理
   */
  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading || disabled) {
      return;
    }

    onSendMessage(trimmedMessage);
    setMessage('');
    
    // フォーカスを維持
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  /**
   * IME変換開始
   */
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  /**
   * IME変換終了
   */
  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  /**
   * キーボードショートカット処理
   * - Enter: 送信（IME変換中は無効）
   * - Shift + Enter: 改行
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // IME変換中は送信しない
      if (isComposing) {
        return;
      }
      
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * テキストエリアの高さを自動調整
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // 高さの自動調整
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const canSend = message.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className={cn(
      // 基本スタイル
      "message-input-container",
      // アニメーション: モーション軽減設定に対応
      !prefersReducedMotion && "transition-all duration-300 ease-in-out",
      prefersReducedMotion && "transition-none", // モーション軽減時はアニメーション無効
      
      // レイアウトモードに応じたスタイル
      actualLayoutMode === 'empty' && [
        // 空チャット状態: 中央配置用のスタイル
        "w-full",
        // 中央配置時は境界線やパディングを調整
        "bg-transparent border-0 p-0"
      ],
      
      actualLayoutMode === 'active' && [
        // アクティブチャット状態: 下部固定用のスタイル
        "border-t bg-background p-4"
      ],
      
      // 遷移中はポインターイベントを無効化（モーション軽減時は除く）
      actualIsTransitioning && !prefersReducedMotion && "pointer-events-none",
      
      className
    )}>
      <div className={cn(
        "flex items-end gap-2",
        // レイアウトモードに応じたコンテナ幅制御
        actualLayoutMode === 'empty' && "w-full max-w-2xl mx-auto",
        actualLayoutMode === 'active' && "max-w-4xl mx-auto"
      )}>
        {/* メッセージ入力エリア */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={placeholder}
            disabled={disabled || isLoading || actualIsTransitioning}
            className={cn(
              "min-h-[44px] max-h-[120px] resize-none",
              "pr-12", // 送信ボタンのスペース確保
              "focus:ring-2 focus:ring-primary/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              // 空チャット状態では特別なスタイル
              actualLayoutMode === 'empty' && [
                "min-h-[56px]", // より大きな高さ
                "text-base", // より大きなフォントサイズ
                "border-2 border-primary/20",
                "focus:border-primary/40 focus:ring-primary/10"
              ]
            )}
            rows={1}
          />
          
          {/* 文字数カウンター（長いメッセージの場合） */}
          {message.length > 500 && (
            <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
              {message.length}/2000
            </div>
          )}
        </div>

        {/* 送信ボタン */}
        <Button
          onClick={handleSendMessage}
          disabled={!canSend || actualIsTransitioning}
          size={actualLayoutMode === 'empty' ? 'default' : 'sm'}
          className={cn(
            // アニメーション: モーション軽減設定に対応
            !prefersReducedMotion && "transition-all duration-200",
            prefersReducedMotion && "transition-none",
            // レイアウトモードに応じたボタンサイズ
            actualLayoutMode === 'empty' && [
              "h-[56px] w-[56px] p-0", // 空チャット時はより大きく
              "rounded-xl" // より丸い角
            ],
            actualLayoutMode === 'active' && [
              "h-[44px] w-[44px] p-0"
            ],
            canSend && !actualIsTransitioning
              ? "bg-primary hover:bg-primary/90" 
              : "bg-muted text-muted-foreground"
          )}
        >
          {isLoading ? (
            <Loader2 className={cn(
              "animate-spin",
              actualLayoutMode === 'empty' ? "h-5 w-5" : "h-4 w-4"
            )} />
          ) : (
            <Send className={cn(
              actualLayoutMode === 'empty' ? "h-5 w-5" : "h-4 w-4"
            )} />
          )}
        </Button>
      </div>

      {/* キーボードショートカットのヒント */}
      <div className={cn(
        "flex justify-between items-center mt-2 text-xs text-muted-foreground",
        actualLayoutMode === 'empty' && "max-w-2xl mx-auto",
        actualLayoutMode === 'active' && "max-w-4xl mx-auto"
      )}>
        <div>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> で送信
          <span className="mx-2">•</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift</kbd> + 
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-1">Enter</kbd> で改行
        </div>
        
        {isLoading && (
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>送信中...</span>
          </div>
        )}
      </div>
    </div>
  );
};