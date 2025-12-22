import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types/chat';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
}

/**
 * MessageBubble コンポーネント
 * ユーザーメッセージとAIメッセージを適切に表示分岐し、
 * AIメッセージにはMarkdownレンダリングを適用
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      "flex w-full",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div 
        className={cn(
          "max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl",
          "px-4 py-3 rounded-lg shadow-sm",
          "break-words", // 長い単語の改行対応
          isUser 
            ? "bg-primary text-primary-foreground ml-4" // ユーザーメッセージ: プライマリカラー、右寄せ
            : "bg-muted text-muted-foreground mr-4" // AIメッセージ: ミュートカラー、左寄せ
        )}
        data-role={message.role}
      >
        {/* メッセージ送信者表示 */}
        <div className={cn(
          "text-xs font-medium mb-2 opacity-70",
          isUser ? "text-right" : "text-left"
        )}>
          {isUser ? 'あなた' : 'AI'}
        </div>
        
        {/* メッセージ内容 */}
        <div className="text-sm leading-relaxed">
          {isUser ? (
            // ユーザーメッセージ: プレーンテキスト表示
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            // AIメッセージ: Markdown レンダリング
            <>
              {message.content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  className="prose prose-sm max-w-none dark:prose-invert"
                  components={{
                    // カスタムコンポーネントでスタイリング調整
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-sm">{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="bg-muted/50 px-1 py-0.5 rounded text-xs font-mono">
                          {children}
                        </code>
                      ) : (
                        <code className="block bg-muted/50 p-2 rounded text-xs font-mono overflow-x-auto">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="bg-muted/50 p-3 rounded-md overflow-x-auto mb-2">
                        {children}
                      </pre>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic mb-2">
                        {children}
                      </blockquote>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold mb-2">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-bold mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-bold mb-2">{children}</h3>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic">{children}</em>
                    ),
                    a: ({ children, href }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline hover:no-underline"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                // 空のメッセージの場合はローディング表示
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-xs text-muted-foreground/70">考え中...</span>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* タイムスタンプ */}
        <div className={cn(
          "text-xs opacity-50 mt-2",
          isUser ? "text-right" : "text-left"
        )}>
          {message.timestamp.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
};