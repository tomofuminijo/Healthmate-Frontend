# Design Document

## Overview

本番用ログイン画面の設計では、現在のテスト用機能を削除し、シンプルで安全、かつプロフェッショナルなログイン体験を提供する。既存のReact + TypeScript + shadcn/ui アーキテクチャを活用し、最小限の変更で最大の効果を得る。

## Architecture

### Component Structure

```
LoginForm (既存コンポーネントの改修)
├── ProductionLoginCard
│   ├── BrandHeader
│   ├── LoginFormFields
│   │   ├── UsernameInput
│   │   └── PasswordInput
│   ├── SubmitButton
│   └── ErrorDisplay
└── LoadingState
```

### Technology Stack

- **Framework**: React 18 + TypeScript
- **UI Library**: shadcn/ui (Card, Input, Button components)
- **Styling**: Tailwind CSS
- **Authentication**: AWS Amplify Auth (@aws-amplify/auth)
- **Routing**: React Router DOM
- **State Management**: React Context (AuthProvider)

## Components and Interfaces

### LoginForm Component (Modified)

```typescript
interface LoginFormProps {
  // No props needed - uses context for auth state
}

interface LoginFormState {
  username: string;
  password: string;
  error: string | null;
  isSubmitting: boolean;
}
```

### BrandHeader Component (New)

```typescript
interface BrandHeaderProps {
  className?: string;
}

// Displays Healthmate branding without test information
```

### LoginFormFields Component (New)

```typescript
interface LoginFormFieldsProps {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  disabled: boolean;
}
```

### ErrorDisplay Component (Enhanced)

```typescript
interface ErrorDisplayProps {
  error: string | null;
  className?: string;
}

// Enhanced to handle production-appropriate error messages
```

## Data Models

### Authentication Flow

```typescript
interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthenticationResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
```

### Error Types

```typescript
enum LoginErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface LoginError {
  type: LoginErrorType;
  message: string;
  userFriendlyMessage: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing the prework analysis, most acceptance criteria are testable as specific examples rather than universal properties. This is appropriate for UI functionality where we're testing specific behaviors and states rather than mathematical properties across infinite inputs. The criteria focus on:

1. **UI Component Presence/Absence**: Testing that specific elements exist or don't exist
2. **User Interaction Flows**: Testing specific user actions and their results
3. **Responsive Design**: Testing display across different viewport sizes
4. **Accessibility Features**: Testing specific accessibility attributes

No redundant properties were identified as each criterion tests a distinct aspect of the login screen functionality.

### Converting EARS to Properties

Based on the prework analysis, the following properties validate our requirements:

**Property 1: Production Login Screen Display**
*For the specific case of* accessing the /login page, the rendered screen should contain username input, password input, login button, and Healthmate branding without any test-specific elements
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 5.1**

**Property 2: Authentication Flow Validation**
*For the specific case of* valid credentials submission, the authentication should succeed and redirect to dashboard
**Validates: Requirements 1.5, 3.4**

**Property 3: Error Handling Validation**
*For the specific case of* invalid credentials or empty fields, appropriate error messages should be displayed
**Validates: Requirements 3.1, 3.3**

**Property 4: Loading State Validation**
*For the specific case of* authentication in progress, loading indicators should be displayed and form should be disabled
**Validates: Requirements 3.2**

**Property 5: Responsive Design Validation**
*For the specific cases of* mobile, tablet, and desktop viewports, the login screen should display appropriately
**Validates: Requirements 4.1, 4.2, 4.3**

**Property 6: Accessibility Validation**
*For the specific case of* keyboard navigation and screen reader usage, appropriate accessibility features should be available
**Validates: Requirements 4.4, 4.5**

**Property 7: Design Consistency Validation**
*For the specific case of* the login screen rendering, it should use shadcn/ui components and consistent styling
**Validates: Requirements 5.2, 5.3**

## Error Handling

### Error Classification

```typescript
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'ユーザー名またはパスワードが正しくありません',
  NETWORK_ERROR: 'ネットワークエラーが発生しました。しばらく後でお試しください',
  VALIDATION_ERROR: 'ユーザー名とパスワードを入力してください',
  UNKNOWN_ERROR: 'ログインに失敗しました。しばらく後でお試しください'
} as const;
```

### Error Display Strategy

- **User-Friendly Messages**: Technical errors are translated to user-friendly Japanese messages
- **Non-Persistent Errors**: Error messages clear when user starts typing
- **Visual Feedback**: Errors displayed with appropriate styling (red background, icon)
- **Accessibility**: Error messages are announced to screen readers

### Loading States

```typescript
interface LoadingState {
  isLoading: boolean;
  message: string;
  disableForm: boolean;
}

const LOADING_STATES = {
  AUTHENTICATING: {
    isLoading: true,
    message: 'ログイン中...',
    disableForm: true
  },
  IDLE: {
    isLoading: false,
    message: '',
    disableForm: false
  }
} as const;
```

## Testing Strategy

### Unit Testing Approach

**Component Testing**:
- Test individual component rendering and props
- Test user interaction handlers
- Test error state management
- Mock authentication context for isolated testing

**Integration Testing**:
- Test complete login flow with real authentication context
- Test navigation and routing behavior
- Test responsive design across viewport sizes

### Property-Based Testing Configuration

Since this feature primarily involves UI interactions and specific user flows, we'll use **example-based testing** rather than property-based testing. Each property will be implemented as a focused integration test that validates specific scenarios.

**Testing Framework**: Vitest + React Testing Library + Playwright (for E2E)
**Test Configuration**: Minimum 1 test per property, covering both success and failure cases
**Tag Format**: **Feature: production-login, Property {number}: {property_text}**

### Test Coverage Strategy

1. **Unit Tests**: Individual component behavior and state management
2. **Integration Tests**: Complete authentication flows and user interactions  
3. **E2E Tests**: Full user journey from login to dashboard
4. **Accessibility Tests**: Keyboard navigation and screen reader compatibility
5. **Visual Regression Tests**: Ensure consistent styling across devices

### Responsive Design Testing

```typescript
const VIEWPORT_SIZES = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 }
} as const;
```

Each responsive design property will be tested across these viewport sizes to ensure consistent behavior and appearance.