# 要件定義書

## はじめに

Healthmate-Frontendサービスは、Healthmateプロダクトの新しいSPAフロントエンドです。既存のHealthmateUIサービスに代わり、モダンなReact + TypeScript技術スタックを使用して、ユーザーフレンドリーなAIチャット体験を提供します。

## 用語集

- **Healthmate_Frontend**: 新しいSPAフロントエンドシステム
- **CoachAI**: Healthmate-CoachAIサービスのAI健康コーチエージェント
- **Cognito_UserPool**: Healthmate-CoreサービスのAmazon Cognito認証システム
- **Chat_Session**: ユーザーとCoachAI間の継続的な会話セッション（AIエージェントのコンテキスト維持）
- **Chat_History**: 一つのChat_Session内でのユーザーとCoachAI間の過去のメッセージやり取り履歴
- **User_Message**: ユーザーがCoachAIに送信したメッセージ（role: 'user'）
- **AI_Message**: CoachAIからユーザーに送信されたメッセージ（role: 'assistant'）
- **Auth_Session**: ブラウザ内でのユーザー認証状態セッション（ログイン/ログアウト状態）
- **JWT_Token**: Cognito認証で発行されるJSONWebToken（通常1時間の有効期限）
- **Refresh_Token**: JWT_Tokenを更新するためのトークン（通常30日の有効期限）
- **Streaming_Response**: AIからのリアルタイム文字表示応答

### トークンと認証セッションの期限について

#### JWT_Token の期限切れ
- **期限**: 通常1時間（Cognito設定による）
- **影響範囲**: API呼び出しが401エラーになる
- **対処法**: Refresh_Tokenを使用して自動更新
- **ユーザー体験**: 通常は気づかない（自動更新）

#### Refresh_Token の期限切れ
- **期限**: 通常30日（Cognito設定による）
- **影響範囲**: JWT_Tokenの自動更新ができなくなる
- **対処法**: 再ログインが必要
- **ユーザー体験**: ログイン画面にリダイレクト

#### Auth_Session の期限切れ
- **期限**: ブラウザセッション終了時またはRefresh_Token期限切れ時
- **影響範囲**: アプリケーション全体の認証状態が無効
- **対処法**: 再ログインが必要
- **ユーザー体験**: ログイン画面にリダイレクト

## 要件

### 要件1: ユーザー認証

**ユーザーストーリー:** ユーザーとして、Healthmate-Core内のCognito UserPoolで認証されることで、安全にアプリケーションにアクセスしたい。

#### 受け入れ基準

1. WHEN ユーザーがアプリケーションにアクセスするとき、THE Healthmate_Frontend SHALL Cognito_UserPoolによる認証を要求する
2. WHEN 認証が成功したとき、THE Healthmate_Frontend SHALL JWT_Tokenを安全に保存し、後続のAPI呼び出しで使用する
3. WHEN JWT_Tokenが期限切れになったとき、THE Healthmate_Frontend SHALL 自動的にトークンを更新するか、再認証を促す
4. WHEN ユーザーがログアウトするとき、THE Healthmate_Frontend SHALL JWT_Tokenを削除し、認証状態をクリアする

### 要件2: AIチャットインターフェース

**ユーザーストーリー:** ユーザーとして、CoachAIと自然な会話ができるチャットインターフェースを使用して、健康に関するアドバイスを受けたい。

#### 受け入れ基準

1. WHEN ユーザーがメッセージを送信するとき、THE Healthmate_Frontend SHALL CoachAIにメッセージを送信し、Streaming_Responseを受信する
2. WHEN CoachAIからの応答を受信するとき、THE Healthmate_Frontend SHALL 文字が順次表示されるストリーミング効果を表示する
3. WHEN AIからの応答がMarkdown形式のとき、THE Healthmate_Frontend SHALL 適切にレンダリングして表示する
4. WHEN チャット中にエラーが発生したとき、THE Healthmate_Frontend SHALL ユーザーにわかりやすいエラーメッセージを表示する

### 要件3: チャットセッション継続性

**ユーザーストーリー:** ユーザーとして、新しいチャットを開始しない限り、同じChat_SessionでCoachAIとの会話を継続したい。

#### 受け入れ基準

1. WHEN ユーザーがチャットを開始するとき、THE Healthmate_Frontend SHALL 一意のChat_Sessionを作成する
2. WHILE Chat_Sessionが継続している間、THE Healthmate_Frontend SHALL Chat_History（メッセージやり取り履歴）を保持し、CoachAIに送信する
3. WHEN ページをリロードしたとき、THE Healthmate_Frontend SHALL 現在のChat_SessionとそのChat_Historyを復元し、会話履歴を表示する
4. WHEN ユーザーが明示的に新しいチャットを開始するまで、THE Healthmate_Frontend SHALL 同じChat_SessionとそのChat_Historyを維持する

### 要件4: 新規チャット機能

**ユーザーストーリー:** ユーザーとして、新しいチャットボタンをクリックして、新しい会話セッションを開始したい。

#### 受け入れ基準

1. THE Healthmate_Frontend SHALL 新しいチャットを開始するためのボタンを提供する
2. WHEN 新しいチャットボタンがクリックされたとき、THE Healthmate_Frontend SHALL 現在のChat_Sessionを終了し、新しいChat_Sessionを作成する
3. WHEN 新しいChat_Sessionが作成されたとき、THE Healthmate_Frontend SHALL Chat_History（メッセージやり取り履歴）をクリアし、新しい会話を開始する
4. WHEN 複数のChat_Sessionが存在するとき、THE Healthmate_Frontend SHALL ユーザーが過去のセッションとそのChat_Historyにアクセスできる機能を提供する

### 要件5: レスポンシブデザイン

**ユーザーストーリー:** ユーザーとして、デスクトップ、タブレット、スマートフォンのどのデバイスからでも快適にアプリケーションを使用したい。

#### 受け入れ基準

1. THE Healthmate_Frontend SHALL モバイルファーストのレスポンシブデザインを実装する
2. WHEN 画面サイズが変更されたとき、THE Healthmate_Frontend SHALL レイアウトを適切に調整する
3. WHEN タッチデバイスで使用されるとき、THE Healthmate_Frontend SHALL タッチ操作に最適化されたインターフェースを提供する
4. THE Healthmate_Frontend SHALL 異なる画面サイズでも読みやすいフォントサイズと適切な余白を維持する

### 要件6: パフォーマンス最適化

**ユーザーストーリー:** ユーザーとして、高速で応答性の高いアプリケーションを使用して、ストレスなくCoachAIと対話したい。

#### 受け入れ基準

1. WHEN アプリケーションが初回読み込みされるとき、THE Healthmate_Frontend SHALL 3秒以内に初期画面を表示する
2. WHEN ユーザーがメッセージを送信するとき、THE Healthmate_Frontend SHALL 即座に送信状態を表示し、応答を待つ
3. THE Healthmate_Frontend SHALL 不要なリソースの読み込みを避け、コード分割を実装する
4. THE Healthmate_Frontend SHALL 画像やアセットを最適化し、読み込み時間を最小化する

### 要件7: アクセシビリティ

**ユーザーストーリー:** 障害を持つユーザーとして、スクリーンリーダーやキーボード操作でもアプリケーションを使用できるようにしたい。

#### 受け入れ基準

1. THE Healthmate_Frontend SHALL WCAG 2.1 AA基準に準拠したアクセシビリティを実装する
2. THE Healthmate_Frontend SHALL 適切なARIAラベルとセマンティックHTMLを使用する
3. THE Healthmate_Frontend SHALL キーボードのみでの操作を完全にサポートする
4. THE Healthmate_Frontend SHALL 十分なカラーコントラストを維持し、色覚異常のユーザーにも配慮する

### 要件9: 認証セッション管理

**ユーザーストーリー:** ユーザーとして、ブラウザを閉じても適切な期間内であればログイン状態を維持し、セキュリティを保ちたい。

#### 受け入れ基準

1. WHEN ユーザーがログインするとき、THE Healthmate_Frontend SHALL Auth_Sessionを確立し、JWT_Tokenを安全に保存する
2. WHILE Auth_Sessionが有効な間、THE Healthmate_Frontend SHALL ユーザーの認証状態を維持する
3. WHEN JWT_Tokenの有効期限が近づいたとき、THE Healthmate_Frontend SHALL 自動的にトークンを更新する
4. WHEN Auth_Sessionが期限切れになったとき、THE Healthmate_Frontend SHALL ユーザーを認証画面にリダイレクトする

### 要件8: エラーハンドリング

**ユーザーストーリー:** ユーザーとして、ネットワークエラーやサーバーエラーが発生した場合でも、適切なフィードバックを受け取り、アプリケーションを継続使用したい。

#### 受け入れ基準

1. WHEN ネットワークエラーが発生したとき、THE Healthmate_Frontend SHALL ユーザーにわかりやすいエラーメッセージを表示する
2. WHEN CoachAIサービスが利用できないとき、THE Healthmate_Frontend SHALL 適切な代替メッセージを表示する
3. WHEN 認証エラーが発生したとき、THE Healthmate_Frontend SHALL ユーザーを認証画面にリダイレクトする
4. THE Healthmate_Frontend SHALL エラー発生時でもアプリケーションの基本機能を維持する

#### 受け入れ基準

1. WHEN ネットワークエラーが発生したとき、THE Healthmate_Frontend SHALL ユーザーにわかりやすいエラーメッセージを表示する
2. WHEN CoachAIサービスが利用できないとき、THE Healthmate_Frontend SHALL 適切な代替メッセージを表示する
3. WHEN 認証エラーが発生したとき、THE Healthmate_Frontend SHALL ユーザーを認証画面にリダイレクトする
4. THE Healthmate_Frontend SHALL エラー発生時でもアプリケーションの基本機能を維持する