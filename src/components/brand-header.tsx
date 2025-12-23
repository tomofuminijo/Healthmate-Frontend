import React from 'react';
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
 */
export const BrandHeader: React.FC<BrandHeaderProps> = ({ 
  className = '',
  showDescription = true,
  size = 'lg'
}) => {
  const titleSizeClasses = {
    sm: 'text-lg sm:text-xl',
    md: 'text-xl sm:text-2xl',
    lg: 'text-2xl sm:text-3xl lg:text-4xl'
  };

  const descriptionSizeClasses = {
    sm: 'text-xs sm:text-sm',
    md: 'text-sm sm:text-base',
    lg: 'text-sm sm:text-base lg:text-lg'
  };

  return (
    <CardHeader className={`text-center space-y-2 px-4 sm:px-6 py-4 sm:py-6 ${className}`}>
      <CardTitle 
        className={`${titleSizeClasses[size]} font-bold text-gray-900 leading-tight`}
        role="banner"
        aria-label="Healthmate - 健康管理プラットフォーム"
      >
        Healthmate
      </CardTitle>
      {showDescription && (
        <CardDescription 
          className={`text-gray-600 ${descriptionSizeClasses[size]} leading-relaxed max-w-sm mx-auto`}
          role="doc-subtitle"
        >
          健康管理プラットフォームにログイン
        </CardDescription>
      )}
    </CardHeader>
  );
};