import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Trash2, MoreHorizontal, Edit, Check, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipeGesture } from '@/hooks/use-swipe-gesture';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logger } from '@/lib/logger';

interface ChatSession {
  id: string;
  title: string;
  messages: any[];
  updatedAt: Date;
}

interface MobileSidebarProps {
  chatSessions: ChatSession[];
  currentChatSession: ChatSession | null;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onUpdateSessionTitle: (sessionId: string, title: string) => void;
  onCreateNewSession: () => void;
  authSession?: {
    username: string;
  };
}

/**
 * MobileSidebar コンポーネント
 * スマホ端末でのハンバーガーメニュー対応サイドバー
 * アクセシビリティ対応: キーボードナビゲーション、モーション軽減設定
 */
export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  chatSessions,
  currentChatSession,
  onSwitchSession,
  onDeleteSession,
  onUpdateSessionTitle,
  onCreateNewSession,
  authSession
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  
  // 編集エリアの参照を保持
  const editingRef = useRef<HTMLDivElement>(null);

  // モーション軽減設定を検出
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // カスタムイベントでサイドバーの開閉を制御
  useEffect(() => {
    const handleToggle = () => {
      setIsOpen(prev => !prev);
    };

    window.addEventListener('toggleMobileSidebar', handleToggle);
    return () => {
      window.removeEventListener('toggleMobileSidebar', handleToggle);
    };
  }, []);

  // サイドバー内での左スワイプで閉じる
  useSwipeGesture({
    onSwipeLeft: () => {
      if (isOpen) {
        logger.debug('🖐️ Swipe left detected - closing sidebar');
        setIsOpen(false);
      }
    }
  });

  // モバイルサイドバーが開いている時は背景スクロールを無効化
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // キーボードナビゲーション対応: Escapeキーでサイドバーを閉じる
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // タイトル編集開始
  const handleStartEditTitle = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  // タイトル編集保存
  const handleSaveTitle = (sessionId: string) => {
    if (editingTitle.trim()) {
      onUpdateSessionTitle(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // タイトル編集キャンセル
  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // 編集モード中の外部クリック検知
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (editingSessionId && editingRef.current && !editingRef.current.contains(event.target as Node)) {
        handleCancelEdit();
      }
    };

    if (editingSessionId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [editingSessionId]);

  // セッション切り替え時にサイドバーを閉じる
  const handleSwitchSession = (sessionId: string) => {
    onSwitchSession(sessionId);
    setIsOpen(false);
  };

  // 新しいチャット作成時にサイドバーを閉じる
  const handleCreateNewSession = () => {
    onCreateNewSession();
    setIsOpen(false);
  };

  return (
    <>
      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* モバイルサイドバー */}
      <div
        className={cn(
          "fixed top-0 left-0 w-80 max-w-[85vw] bg-background border-r z-50 md:hidden flex flex-col",
          // アニメーション: モーション軽減設定に対応
          !prefersReducedMotion && [
            "transform transition-transform duration-300 ease-in-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          ],
          prefersReducedMotion && [
            // モーション軽減時は即座に表示/非表示
            isOpen ? "block" : "hidden"
          ]
        )}
        style={{
          height: '100vh',
          maxHeight: '100vh'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-sidebar-title"
        aria-hidden={!isOpen}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="mobile-sidebar-title" className="font-semibold text-lg">チャット</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            aria-label="サイドバーを閉じる"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 新しいチャットボタン */}
        <div className="p-4 border-b flex-shrink-0">
          <Button
            onClick={handleCreateNewSession}
            className="w-full"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            新しいチャット
          </Button>
        </div>

        {/* セッション一覧 */}
        <div 
          className="flex-1 overflow-y-auto p-2"
          style={{ 
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch' // iOS Safari でのスムーズスクロール
          }}
        >
          <div className="space-y-1" role="list" aria-label="チャット一覧">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "p-3 rounded-lg cursor-pointer transition-colors group",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  session.id === currentChatSession?.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted/50"
                )}
                onClick={() => handleSwitchSession(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSwitchSession(session.id);
                  }
                }}
                tabIndex={0}
                role="listitem"
                aria-label={`チャット: ${session.title}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    {editingSessionId === session.id ? (
                      // タイトル編集モード
                      <div className="flex items-center gap-2" ref={editingRef}>
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onCompositionStart={() => setIsComposing(true)}
                          onCompositionEnd={() => setIsComposing(false)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter' && !isComposing) {
                              handleSaveTitle(session.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          className="h-6 text-sm text-foreground bg-background border-input"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveTitle(session.id);
                          }}
                          className="h-6 w-6 p-0"
                          aria-label="保存"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="h-6 w-6 p-0"
                          aria-label="キャンセル"
                        >
                          <XIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      // 通常表示モード
                      <>
                        <div className="font-medium text-sm truncate">
                          {session.title}
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {session.messages.length}件のメッセージ
                        </div>
                        <div className="text-xs opacity-50 mt-1">
                          {session.updatedAt.toLocaleDateString('ja-JP')}
                        </div>
                      </>
                    )}
                  </div>
                  {chatSessions.length > 1 && editingSessionId !== session.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="h-6 w-6 p-0 transition-opacity"
                          aria-label="セッションメニュー"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditTitle(session.id, session.title);
                          }}
                          className="cursor-pointer"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          名前を変更する
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          削除する
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* システム情報 */}
        {authSession && (
          <div className="p-4 border-t bg-muted/20 flex-shrink-0">
            <div className="text-xs text-muted-foreground space-y-1">
              <div><strong>ユーザー:</strong> {authSession.username}</div>
              <div><strong>チャット数:</strong> {chatSessions.length}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

/**
 * DesktopSidebar コンポーネント
 * デスクトップ用の従来のサイドバー
 */
interface DesktopSidebarProps extends MobileSidebarProps {}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  chatSessions,
  currentChatSession,
  onSwitchSession,
  onDeleteSession,
  onUpdateSessionTitle,
  onCreateNewSession,
  authSession
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  
  // 編集エリアの参照を保持
  const editingRef = useRef<HTMLDivElement>(null);

  // タイトル編集開始
  const handleStartEditTitle = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  // タイトル編集保存
  const handleSaveTitle = (sessionId: string) => {
    if (editingTitle.trim()) {
      onUpdateSessionTitle(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // タイトル編集キャンセル
  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // 編集モード中の外部クリック検知
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (editingSessionId && editingRef.current && !editingRef.current.contains(event.target as Node)) {
        handleCancelEdit();
      }
    };

    if (editingSessionId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [editingSessionId]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm text-muted-foreground">
            チャット ({chatSessions.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreateNewSession}
            aria-label="新しいチャットを作成"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div 
        className="flex-1 overflow-y-auto p-2"
        style={{ 
          overscrollBehavior: 'contain'
        }}
      >
        <div className="space-y-1">
          {chatSessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "p-3 rounded-lg cursor-pointer transition-colors group",
                session.id === currentChatSession?.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted/50"
              )}
              onClick={() => onSwitchSession(session.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  {editingSessionId === session.id ? (
                    // タイトル編集モード
                    <div className="flex items-center gap-2" ref={editingRef}>
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={() => setIsComposing(false)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter' && !isComposing) {
                            handleSaveTitle(session.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        className="h-6 text-sm text-foreground bg-background border-input"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveTitle(session.id);
                        }}
                        className="h-6 w-6 p-0"
                        aria-label="保存"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        className="h-6 w-6 p-0"
                        aria-label="キャンセル"
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    // 通常表示モード
                    <>
                      <div className="font-medium text-sm truncate">
                        {session.title}
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {session.messages.length}件のメッセージ
                      </div>
                      <div className="text-xs opacity-50 mt-1">
                        {session.updatedAt.toLocaleDateString('ja-JP')}
                      </div>
                    </>
                  )}
                </div>
                {chatSessions.length > 1 && editingSessionId !== session.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="セッションメニュー"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditTitle(session.id, session.title);
                        }}
                        className="cursor-pointer"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        名前を変更する
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        削除する
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* システム情報 */}
      {authSession && (
        <div className="p-4 border-t bg-background/50 flex-shrink-0">
          <div className="text-xs text-muted-foreground space-y-1">
            <div><strong>ユーザー:</strong> {authSession.username}</div>
          </div>
        </div>
      )}
    </div>
  );
};