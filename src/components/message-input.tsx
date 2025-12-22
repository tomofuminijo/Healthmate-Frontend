import React, { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Send, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * MessageInput コンポーネント
 * メッセージ入力フォームとキーボードショートカット対応
 */
export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isLoading = false,
  disabled = false,
  placeholder = "メッセージを入力してください...",
  className
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
   * キーボードショートカット処理
   * - Enter: 送信
   * - Shift + Enter: 改行
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
      "border-t bg-background p-4",
      className
    )}>
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        {/* メッセージ入力エリア */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className={cn(
              "min-h-[44px] max-h-[120px] resize-none",
              "pr-12", // 送信ボタンのスペース確保
              "focus:ring-2 focus:ring-primary/20",
              "disabled:opacity-50 disabled:cursor-not-allowed"
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
          disabled={!canSend}
          size="sm"
          className={cn(
            "h-[44px] w-[44px] p-0",
            "transition-all duration-200",
            canSend 
              ? "bg-primary hover:bg-primary/90" 
              : "bg-muted text-muted-foreground"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* キーボードショートカットのヒント */}
      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground max-w-4xl mx-auto">
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