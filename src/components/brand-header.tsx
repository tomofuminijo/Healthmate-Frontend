import React, { useMemo } from 'react';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface BrandHeaderProps {
  className?: string;
  showDescription?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Healthmateブランドヘッダーコンポーネント
 * ログイン画面やその他の認証関連ページで使用される統一されたブランディング表示
 * レスポンシブデザインとアクセシビリティに対応
 * パフォーマンス最適化済み
 */
export const BrandHeader: React.FC<BrandHeaderProps> = React.memo(({ 
  className = '',
  showDescription = true,
  size = 'lg'
}) => {
  // スタイルクラスをメモ化
  const titleClasses = useMemo(() => {
    const sizeClasses = {
      sm: 'text-lg sm:text-xl',
      md: 'text-xl sm:text-2xl',
      lg: 'text-2xl sm:text-3xl lg:text-4xl'
    };
    return `${sizeClasses[size]} font-bold text-gray-900 leading-tight`;
  }, [size]);

  const descriptionClasses = useMemo(() => {
    const sizeClasses = {
      sm: 'text-xs sm:text-sm',
      md: 'text-sm sm:text-base',
      lg: 'text-sm sm:text-base lg:text-lg'
    };
    return `text-gray-600 ${sizeClasses[size]} leading-relaxed max-w-sm mx-auto`;
  }, [size]);

  return (
    <CardHeader className={`text-center space-y-2 px-4 sm:px-6 py-4 sm:py-6 ${className}`}>
      <CardTitle 
        className={titleClasses}
        role="banner"
        aria-label="Healthmate - 健康管理プラットフォーム"
      >
        Healthmate
      </CardTitle>
      {showDescription && (
        <CardDescription 
          className={descriptionClasses}
          role="doc-subtitle"
        >
          健康管理プラットフォームにログイン
        </CardDescription>
      )}
    </CardHeader>
  );
});

BrandHeader.displayName = 'BrandHeader';