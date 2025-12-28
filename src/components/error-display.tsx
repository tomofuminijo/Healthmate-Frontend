import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppError, ErrorHandler, ErrorType } from '@/lib/error-handler';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { 
  AlertTriangle, 
  Wifi, 
  Server, 
  Clock, 
  Shield, 
  RefreshCw,
  X 
} from 'lucide-react';

interface ErrorDisplayProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * ErrorDisplay コンポーネント
 * エラーの種類に応じた適切な表示とアクション
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className,
  compact = false
}) => {
  const severity = ErrorHandler.getSeverity(error);
  const actionMessage = ErrorHandler.getActionMessage(error);

  // エラータイプに応じたアイコンを取得
  const getErrorIcon = () => {
    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        return <Wifi className="h-5 w-5" />;
      case ErrorType.SERVICE_UNAVAILABLE:
        return <Server className="h-5 w-5" />;
      case ErrorType.TIMEOUT_ERROR:
        return <Clock className="h-5 w-5" />;
      case ErrorType.AUTHENTICATION_ERROR:
        return <Shield className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  // 重要度に応じたスタイル
  const getSeverityStyles = () => {
    switch (severity) {
      case 'critical':
        return 'border-destructive bg-destructive/5 text-destructive';
      case 'high':
        return 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
      default:
        return 'border-muted bg-muted/50 text-muted-foreground';
    }
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        getSeverityStyles(),
        className
      )}>
        {getErrorIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{error.message}</p>
          <p className="text-xs opacity-70">
            {error.timestamp.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          {error.retryable && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      "border",
      getSeverityStyles(),
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {getErrorIcon()}
          <CardTitle className="text-base">
            {getErrorTitle(error.type)}
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          {error.message}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0">
        {error.details && (
          <details className="mb-4">
            <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
              技術的な詳細
            </summary>
            <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-x-auto">
              {error.details}
            </pre>
          </details>
        )}
        
        <div className="flex items-center justify-between">
          <div className="text-xs opacity-70">
            発生時刻: {error.timestamp.toLocaleString()}
          </div>
          
          <div className="flex gap-2">
            {error.retryable && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-8"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                再試行
              </Button>
            )}
            
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-8"
              >
                閉じる
              </Button>
            )}
          </div>
        </div>
        
        {actionMessage && (
          <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
            💡 {actionMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * エラータイプに応じたタイトルを取得
 */
function getErrorTitle(type: ErrorType): string {
  switch (type) {
    case ErrorType.NETWORK_ERROR:
      return 'ネットワークエラー';
    case ErrorType.SERVICE_UNAVAILABLE:
      return 'サービス利用不可';
    case ErrorType.TIMEOUT_ERROR:
      return 'タイムアウト';
    case ErrorType.AUTHENTICATION_ERROR:
      return '認証エラー';
    case ErrorType.API_ERROR:
      return 'APIエラー';
    default:
      return 'エラー';
  }
}

/**
 * エラー境界コンポーネント
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const appError = ErrorHandler.classify(this.state.error);
      
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <ErrorDisplay
              error={appError}
              onRetry={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}