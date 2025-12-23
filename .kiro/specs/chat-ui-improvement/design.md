# 設計文書

## 概要

Healthmate-Frontend のチャットインターフェースにChatGPTライクなユーザーエクスペリエンスを実装します。動的レイアウトシステムにより、空チャット状態では入力欄を中央配置し、アクティブチャット状態では下部固定レイアウトに遷移します。既存のReact + TypeScript + Tailwind CSS技術スタックを活用し、シンプルで保守性の高い実装を目指します。

## アーキテクチャ

### 全体構成

```
ChatInterface (既存)
├── ChatLayoutManager (新規) - レイアウト状態管理
├── MessageList (改良) - スクロール制御改善
├── MessageInput (改良) - 位置制御対応
└── ScrollToBottomButton (新規) - 最下部移動機能
```

### 状態管理アプローチ

- **レイアウト状態**: React useState でローカル管理
- **スクロール制御**: useRef + useEffect による直接DOM操作
- **アニメーション**: CSS Transitions + Tailwind CSS
- **既存状態**: 現在のチャット状態管理を維持

## コンポーネント設計

### 1. ChatLayoutManager (新規コンポーネント)

レイアウト状態の管理と遷移制御を担当する中央管理コンポーネント。

```typescript
interface ChatLayoutManagerProps {
  hasMessages: boolean;
  children: React.ReactNode;
}

interface LayoutState {
  mode: 'empty' | 'active';
  isTransitioning: boolean;
}
```

**責任:**
- 空チャット状態とアクティブチャット状態の判定
- レイアウトモードの管理
- 遷移アニメーションの制御
- 子コンポーネントへの状態提供

**実装パターン:**
```typescript
const ChatLayoutManager: React.FC<ChatLayoutManagerProps> = ({ hasMessages, children }) => {
  const [layoutState, setLayoutState] = useState<LayoutState>({
    mode: hasMessages ? 'active' : 'empty',
    isTransitioning: false
  });

  // メッセージ有無の変化を監視してレイアウト遷移
  useEffect(() => {
    const newMode = hasMessages ? 'active' : 'empty';
    if (newMode !== layoutState.mode) {
      setLayoutState(prev => ({ ...prev, isTransitioning: true }));
      // 遷移アニメーション後に状態更新
      setTimeout(() => {
        setLayoutState({ mode: newMode, isTransitioning: false });
      }, 300);
    }
  }, [hasMessages, layoutState.mode]);

  return (
    <div className={`chat-layout ${layoutState.mode} ${layoutState.isTransitioning ? 'transitioning' : ''}`}>
      {children}
    </div>
  );
};
```

### 2. MessageList (既存コンポーネント改良)

スクロール動作の制御を改善し、新しい要件に対応。

**改良点:**
- ユーザーメッセージ送信時の上部表示スクロール
- AIレスポンス時の非オートスクロール
- スクロール位置の状態管理

```typescript
interface ScrollBehavior {
  autoScrollOnUserMessage: boolean;
  autoScrollOnAIResponse: boolean;
  scrollToUserMessage: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, className }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);

  // ユーザーメッセージ送信時のスクロール制御
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user' && lastMessage.id !== lastUserMessageId) {
      setLastUserMessageId(lastMessage.id);
      scrollToUserMessage(lastMessage.id);
    }
  }, [messages, lastUserMessageId]);

  const scrollToUserMessage = (messageId: string) => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement && scrollRef.current) {
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };
};
```

### 3. MessageInput (既存コンポーネント改良)

レイアウトモードに応じた位置制御に対応。

**改良点:**
- 中央配置と下部固定の切り替え対応
- アニメーション遷移のサポート
- レスポンシブ対応の強化

```typescript
interface MessageInputProps extends ExistingProps {
  layoutMode: 'empty' | 'active';
  isTransitioning: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ 
  layoutMode, 
  isTransitioning, 
  ...existingProps 
}) => {
  return (
    <div className={cn(
      "message-input-container",
      "transition-all duration-300 ease-in-out",
      layoutMode === 'empty' && "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl px-4",
      layoutMode === 'active' && "sticky bottom-0 w-full",
      isTransitioning && "pointer-events-none"
    )}>
      {/* 既存のMessageInputコンテンツ */}
    </div>
  );
};
```

### 4. ScrollToBottomButton (新規コンポーネント)

チャット最下部への移動機能を提供。

```typescript
interface ScrollToBottomButtonProps {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  isVisible: boolean;
}

const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({ 
  scrollContainerRef, 
  isVisible 
}) => {
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToBottom}
      className={cn(
        "fixed bottom-20 left-1/2 transform -translate-x-1/2",
        "bg-primary text-primary-foreground",
        "rounded-full p-2 shadow-lg",
        "hover:bg-primary/90 transition-colors",
        "z-10"
      )}
      aria-label="チャット最下部に移動"
    >
      <ChevronDown className="h-4 w-4" />
    </button>
  );
};
```

## データモデル

### レイアウト状態管理

```typescript
interface ChatLayoutState {
  mode: 'empty' | 'active';
  isTransitioning: boolean;
  previousMode?: 'empty' | 'active';
}

interface ScrollState {
  isAtBottom: boolean;
  isUserScrolling: boolean;
  lastScrollTop: number;
  showScrollButton: boolean;
}
```

### メッセージ表示制御

```typescript
interface MessageDisplayConfig {
  autoScrollOnUserMessage: boolean;
  autoScrollOnAIChunk: boolean;
  scrollToUserMessageOnSend: boolean;
  maintainScrollPositionDuringAI: boolean;
}
```

## CSS設計とアニメーション

### Tailwind CSS クラス設計

```css
/* レイアウトモード */
.chat-layout-empty {
  @apply flex items-center justify-center min-h-screen;
}

.chat-layout-active {
  @apply flex flex-col h-screen;
}

/* 遷移アニメーション */
.chat-input-transition {
  @apply transition-all duration-300 ease-in-out;
}

/* レスポンシブ対応 */
.chat-container {
  @apply max-w-4xl mx-auto px-4;
}

@media (max-width: 768px) {
  .chat-container {
    @apply max-w-full px-2;
  }
}
```

### アニメーション仕様

```typescript
const ANIMATION_CONFIG = {
  layoutTransition: {
    duration: 300, // ms
    easing: 'ease-in-out',
    properties: ['transform', 'opacity', 'position']
  },
  scrollAnimation: {
    userMessageScroll: 200, // ms
    bottomScroll: 300, // ms
    behavior: 'smooth' as ScrollBehavior
  }
};
```

## エラーハンドリング

### スクロール制御エラー

```typescript
const safeScrollTo = (element: HTMLElement, options: ScrollToOptions) => {
  try {
    element.scrollTo(options);
  } catch (error) {
    console.warn('Scroll operation failed:', error);
    // フォールバック: 即座にスクロール
    element.scrollTop = options.top || 0;
  }
};
```

### レイアウト遷移エラー

```typescript
const handleLayoutTransitionError = (error: Error) => {
  console.error('Layout transition failed:', error);
  // 安全な状態に復帰
  setLayoutState({ mode: 'active', isTransitioning: false });
};
```

## テスト戦略

### 単体テスト

- **ChatLayoutManager**: レイアウト状態遷移のテスト
- **ScrollToBottomButton**: クリック動作とスクロール制御のテスト
- **MessageList**: スクロール動作の各パターンテスト
- **MessageInput**: レイアウトモード切り替えのテスト

### 統合テスト

- **レイアウト遷移フロー**: 空→アクティブ状態の完全な遷移テスト
- **スクロール動作**: ユーザーメッセージ送信からスクロールまでのE2Eテスト
- **レスポンシブ動作**: 異なる画面サイズでの動作テスト

### プロパティベーステスト

プロパティベーステストは、受け入れ基準の分析に基づいて実装します。

## 実装優先順位

### Phase 1: 基本レイアウト制御
1. ChatLayoutManager の実装
2. MessageInput の位置制御対応
3. 基本的な中央↔下部遷移

### Phase 2: スクロール制御改善
1. MessageList のスクロール動作改良
2. ユーザーメッセージ送信時のスクロール
3. AIレスポンス時の非オートスクロール

### Phase 3: 追加機能
1. ScrollToBottomButton の実装
2. アニメーション改善
3. レスポンシブ対応強化

### Phase 4: 最適化とテスト
1. パフォーマンス最適化
2. テストカバレッジ向上
3. アクセシビリティ対応

## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において真であるべき特性や動作のことです。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。*

### プロパティ1: レスポンシブレイアウトの一貫性

*任意の* 画面サイズ（320px〜1920px幅）において、チャットインターフェースは適切なレイアウトを維持し、入力エリアの中央配置（空チャット時）または下部固定（アクティブチャット時）の動作を保持する
**検証対象: 要件 1.4, 3.2, 3.3, 3.4, 5.1, 5.4**

### プロパティ2: メッセージ追加時の動作一貫性

*任意の* メッセージ追加パターン（単一メッセージ、連続メッセージ、AI応答）において、システムは適切なスクロール制御とレイアウト維持を行う
**検証対象: 要件 2.4, 6.4**

### プロパティ3: 既存機能の後方互換性

*任意の* 既存チャット機能（メッセージ送信、表示、セッション管理、認証）において、UI改良後も元の動作を変更なく維持する
**検証対象: 要件 9.1, 9.2, 9.3, 9.4**