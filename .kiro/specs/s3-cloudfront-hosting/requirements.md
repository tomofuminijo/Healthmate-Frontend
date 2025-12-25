# Requirements Document

## Introduction

Healthmate-Frontend を Amazon S3 + CloudFront を使用してインターネット経由でアクセス可能にするための静的ホスティング機能。テスト用途のため、独自ドメインの設定は不要で、CloudFront のデフォルトドメインを使用する。

## Glossary

- **S3_Bucket**: 静的ファイルを格納する Amazon S3 バケット
- **CloudFront_Distribution**: S3 バケットの前段に配置される CDN サービス
- **Static_Assets**: ビルドされた HTML、CSS、JavaScript ファイル群
- **CDK_Stack**: AWS リソースを管理する Infrastructure as Code スタック
- **Build_Output**: Vite ビルドプロセスによって生成される dist/ ディレクトリの内容

## Requirements

### Requirement 1: S3 バケット作成と設定

**User Story:** As a developer, I want to create an S3 bucket for hosting static files, so that the frontend application can be served from AWS infrastructure.

#### Acceptance Criteria

1. THE CDK_Stack SHALL create a new S3_Bucket with public read access for static hosting
2. WHEN the S3_Bucket is created, THE CDK_Stack SHALL configure it for static website hosting with index.html as the default document
3. WHEN the S3_Bucket is created, THE CDK_Stack SHALL set appropriate CORS configuration for frontend API calls
4. THE S3_Bucket SHALL have a unique name following the pattern "healthmate-frontend-{environment}-{random-suffix}"
5. WHEN the S3_Bucket is created, THE CDK_Stack SHALL enable versioning for deployment rollback capability

### Requirement 2: CloudFront Distribution 設定

**User Story:** As a user, I want to access the frontend through CloudFront, so that I can benefit from global CDN performance and caching.

#### Acceptance Criteria

1. THE CDK_Stack SHALL create a CloudFront_Distribution that points to the S3_Bucket as origin
2. WHEN the CloudFront_Distribution is created, THE CDK_Stack SHALL configure default caching behavior for Static_Assets
3. WHEN a request is made to CloudFront_Distribution, THE CloudFront_Distribution SHALL serve index.html for SPA routing (404 errors redirect to index.html)
4. THE CloudFront_Distribution SHALL compress Static_Assets automatically for better performance
5. WHEN the CloudFront_Distribution is created, THE CDK_Stack SHALL output the distribution domain name for access

### Requirement 3: ビルドとデプロイメント自動化

**User Story:** As a developer, I want to automate the build and deployment process, so that I can easily update the hosted application.

#### Acceptance Criteria

1. THE Deployment_Script SHALL execute "npm run build" to generate Build_Output in the dist/ directory
2. WHEN Build_Output is generated, THE Deployment_Script SHALL upload all files to the S3_Bucket
3. WHEN files are uploaded to S3_Bucket, THE Deployment_Script SHALL invalidate CloudFront_Distribution cache
4. THE Deployment_Script SHALL preserve file permissions and MIME types during upload
5. WHEN deployment completes, THE Deployment_Script SHALL output the CloudFront URL for immediate access

### Requirement 4: 環境変数とビルド設定

**User Story:** As a developer, I want to configure environment-specific settings, so that the application works correctly in the hosted environment.

#### Acceptance Criteria

1. THE Build_Process SHALL use environment variables from .env files for API endpoints configuration
2. WHEN building for production, THE Build_Process SHALL optimize Static_Assets for size and performance
3. THE Build_Process SHALL generate source maps for debugging while maintaining security
4. WHEN Static_Assets are built, THE Build_Process SHALL ensure all relative paths work correctly in S3/CloudFront environment
5. THE Build_Process SHALL validate that all required environment variables are present before building

### Requirement 5: セキュリティとアクセス制御

**User Story:** As a security-conscious developer, I want to implement appropriate security measures, so that the hosted application is secure while remaining publicly accessible.

#### Acceptance Criteria

1. THE S3_Bucket SHALL block public access to non-website endpoints while allowing CloudFront access
2. WHEN CloudFront_Distribution serves content, THE CloudFront_Distribution SHALL add security headers (HSTS, X-Content-Type-Options, etc.)
3. THE S3_Bucket SHALL use server-side encryption for stored Static_Assets
4. THE CloudFront_Distribution SHALL only allow HTTPS connections and redirect HTTP to HTTPS
5. WHEN accessing the application, THE CloudFront_Distribution SHALL not expose S3 bucket details in responses

### Requirement 6: モニタリングとログ

**User Story:** As a developer, I want to monitor the hosted application, so that I can troubleshoot issues and understand usage patterns.

#### Acceptance Criteria

1. THE CloudFront_Distribution SHALL enable access logging to an S3 bucket for analysis
2. WHEN errors occur, THE CloudFront_Distribution SHALL provide meaningful error pages
3. THE CDK_Stack SHALL create CloudWatch alarms for monitoring distribution health
4. THE S3_Bucket SHALL enable access logging for security auditing
5. WHEN deployment occurs, THE Deployment_Script SHALL log deployment status and any errors

### Requirement 7: コスト最適化

**User Story:** As a cost-conscious developer, I want to optimize hosting costs, so that the solution remains economical for testing purposes.

#### Acceptance Criteria

1. THE S3_Bucket SHALL use Standard storage class with lifecycle policies for cost optimization
2. THE CloudFront_Distribution SHALL use appropriate price class for testing (PriceClass_100 for US/Europe)
3. WHEN Static_Assets are not accessed frequently, THE S3_Bucket SHALL transition them to cheaper storage classes
4. THE CloudFront_Distribution SHALL have reasonable TTL settings to balance performance and cost
5. THE CDK_Stack SHALL include cost allocation tags for tracking expenses

### Requirement 8: 削除とクリーンアップ

**User Story:** As a developer, I want to easily clean up resources, so that I can avoid unnecessary costs when testing is complete.

#### Acceptance Criteria

1. THE CDK_Stack SHALL support complete resource deletion through "cdk destroy"
2. WHEN destroying the stack, THE Cleanup_Process SHALL empty the S3_Bucket before deletion
3. THE Cleanup_Process SHALL disable CloudFront_Distribution before deletion to avoid errors
4. WHEN cleanup occurs, THE Cleanup_Process SHALL remove all associated IAM roles and policies
5. THE Cleanup_Process SHALL provide confirmation of successful resource deletion