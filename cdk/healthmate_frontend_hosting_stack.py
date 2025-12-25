"""
Healthmate Frontend Hosting Stack

This module defines the CDK stack for hosting the Healthmate Frontend
using Amazon S3 and CloudFront.
"""

import uuid
from dataclasses import dataclass
from typing import Literal, Optional

import aws_cdk as cdk
from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_iam as iam,
    aws_logs as logs,
    CfnOutput,
    RemovalPolicy,
    Duration,
    Tags
)
from constructs import Construct


@dataclass
class HostingStackProps:
    """Properties for the Healthmate Frontend Hosting Stack."""
    environment: Literal['dev', 'stage', 'prod']
    domain_name: Optional[str] = None  # 将来の独自ドメイン対応用
    
    def __post_init__(self):
        """Validate environment value."""
        if self.environment not in ['dev', 'stage', 'prod']:
            raise ValueError(f"Invalid environment '{self.environment}'. Must be one of: dev, stage, prod")


class HealthmateFrontendHostingStack(Stack):
    """
    CDK Stack for Healthmate Frontend S3 + CloudFront hosting.
    
    This stack creates:
    - S3 bucket for static website hosting
    - CloudFront distribution for global CDN
    - IAM roles and policies for deployment
    - CloudWatch logging and monitoring
    """

    def __init__(self, scope: Construct, construct_id: str, props: HostingStackProps, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)
        
        self.props = props
        self.distribution_domain_name: str = ""
        self.bucket_name: str = ""
        
        # Generate unique suffix for bucket name
        self._unique_suffix = str(uuid.uuid4())[:8]
        
        # Create S3 bucket for static hosting
        self._create_s3_bucket()
        
        # Create CloudFront distribution
        self._create_cloudfront_distribution()
        
        # Create outputs
        self._create_outputs()
        
        # Validate bucket configuration
        self._validate_bucket_configuration()

    def _validate_bucket_configuration(self) -> None:
        """
        Validate that the S3 bucket is configured correctly according to requirements.
        
        This method adds CloudFormation conditions and assertions to ensure
        the bucket meets all specified requirements.
        """
        # Add CloudFormation condition to validate bucket name pattern
        bucket_name_pattern = f"healthmate-frontend-{self.props.environment}-"
        
        # Ensure bucket name follows the required pattern (Requirement 1.4)
        if not self.bucket_name.startswith(bucket_name_pattern):
            raise ValueError(
                f"Bucket name '{self.bucket_name}' does not follow required pattern: "
                f"'healthmate-frontend-{{environment}}-{{random-suffix}}'"
            )
        
        # Validate bucket name length (S3 bucket names must be 3-63 characters)
        if len(self.bucket_name) < 3 or len(self.bucket_name) > 63:
            raise ValueError(
                f"Bucket name '{self.bucket_name}' length ({len(self.bucket_name)}) "
                f"must be between 3 and 63 characters"
            )
        
        # Add tags for cost tracking and management
        Tags.of(self.bucket).add("Environment", self.props.environment)
        Tags.of(self.bucket).add("Service", "healthmate-frontend")
        Tags.of(self.bucket).add("CostCenter", "healthmate")
        Tags.of(self.bucket).add("Purpose", "StaticWebsiteHosting")
        Tags.of(self.bucket).add("ContentType", "Frontend")
        Tags.of(self.bucket).add("BackupRequired", "false")  # Static assets can be rebuilt

    def _create_s3_bucket(self) -> None:
        """
        Create and configure S3 bucket for static website hosting.
        
        Requirements addressed:
        - 1.1: Create S3_Bucket with CloudFront access for static hosting
        - 1.2: Configure static website hosting with index.html as default document
        - 1.4: Unique name following pattern "healthmate-frontend-{environment}-{random-suffix}"
        - 1.5: Enable versioning for deployment rollback capability
        """
        # Generate bucket name following the required pattern (Requirement 1.4)
        self.bucket_name = f"healthmate-frontend-{self.props.environment}-{self._unique_suffix}"
        
        # Create S3 bucket with comprehensive configuration
        self.bucket = s3.Bucket(
            self,
            "HostingBucket",
            bucket_name=self.bucket_name,
            # Requirement 1.5: Enable versioning for deployment rollback capability
            versioned=True,
            # Requirement 5.3: Server-side encryption (SSE-S3) for stored static assets
            encryption=s3.BucketEncryption.S3_MANAGED,
            # Security: Block public access - CloudFront will access via OAC
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            # Testing: Allow bucket deletion for easy cleanup
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            # Lifecycle configuration for cost optimization
            lifecycle_rules=[
                s3.LifecycleRule(
                    id="DeleteOldVersions",
                    enabled=True,
                    noncurrent_version_expiration=cdk.Duration.days(30),
                    abort_incomplete_multipart_upload_after=cdk.Duration.days(1)
                )
            ]
        )
        
        # Note: No CORS configuration needed for static hosting
        # CORS is configured on the API side, not the static asset side

    def _create_cloudfront_distribution(self) -> None:
        """Create and configure CloudFront distribution with Origin Access Control (OAC)."""
        # Create Origin Access Control (OAC) for S3 access - modern approach
        self.origin_access_control = cloudfront.S3OriginAccessControl(
            self,
            "OriginAccessControl",
            description=f"OAC for Healthmate Frontend {self.props.environment}"
        )
        
        # Create S3 origin with OAC
        s3_origin = origins.S3BucketOrigin.with_origin_access_control(
            self.bucket,
            origin_access_control=self.origin_access_control
        )
        
        # Create Response Headers Policy for security headers
        self.response_headers_policy = self._create_security_headers_policy()
        
        # Create custom cache policy that disables caching
        no_cache_policy = cloudfront.CachePolicy(
            self,
            "NoCachePolicy",
            cache_policy_name=f"healthmate-frontend-no-cache-{self.props.environment}",
            comment=f"No caching policy for Healthmate Frontend {self.props.environment}",
            default_ttl=Duration.seconds(0),
            max_ttl=Duration.seconds(0),
            min_ttl=Duration.seconds(0),
            cookie_behavior=cloudfront.CacheCookieBehavior.none(),
            header_behavior=cloudfront.CacheHeaderBehavior.none(),
            query_string_behavior=cloudfront.CacheQueryStringBehavior.none(),
            # Note: Compression settings are not allowed when caching is disabled
        )
        
        # Create CloudFront distribution
        self.distribution = cloudfront.Distribution(
            self,
            "Distribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=s3_origin,
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cached_methods=cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                compress=True,  # Enable compression for better performance
                cache_policy=no_cache_policy,  # Use no-cache policy instead of optimized caching
                response_headers_policy=self.response_headers_policy,  # Apply security headers
            ),
            default_root_object="index.html",
            # Configure error pages for SPA routing
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.minutes(5)
                ),
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.minutes(5)
                )
            ],
            # Use cost-effective price class for testing
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
            comment=f"Healthmate Frontend Distribution - {self.props.environment}",
            enabled=True
        )
        
        # Add tags to CloudFront distribution for cost tracking and management
        Tags.of(self.distribution).add("Environment", self.props.environment)
        Tags.of(self.distribution).add("Service", "healthmate-frontend")
        Tags.of(self.distribution).add("CostCenter", "healthmate")
        Tags.of(self.distribution).add("Purpose", "CDN")
        Tags.of(self.distribution).add("ContentType", "Frontend")
        Tags.of(self.distribution).add("BackupRequired", "false")  # CDN can be recreated
        
        # Store distribution domain name
        self.distribution_domain_name = self.distribution.distribution_domain_name

    def _create_security_headers_policy(self) -> cloudfront.ResponseHeadersPolicy:
        """
        Create Response Headers Policy for security headers.
        
        Requirements addressed:
        - 5.2: Security headers (HSTS, X-Content-Type-Options, etc.)
        - 5.4: HTTPS enforcement and security best practices
        """
        return cloudfront.ResponseHeadersPolicy(
            self,
            "SecurityHeadersPolicy",
            response_headers_policy_name=f"healthmate-frontend-security-{self.props.environment}",
            comment=f"Security headers policy for Healthmate Frontend {self.props.environment}",
            # Security Headers Configuration
            security_headers_behavior=cloudfront.ResponseSecurityHeadersBehavior(
                # HTTP Strict Transport Security (HSTS)
                strict_transport_security=cloudfront.ResponseHeadersStrictTransportSecurity(
                    access_control_max_age=Duration.seconds(31536000),  # 1 year
                    include_subdomains=True,
                    preload=True,
                    override=True
                ),
                # Content Type Options
                content_type_options=cloudfront.ResponseHeadersContentTypeOptions(
                    override=True
                ),
                # Frame Options
                frame_options=cloudfront.ResponseHeadersFrameOptions(
                    frame_option=cloudfront.HeadersFrameOption.DENY,
                    override=True
                ),
                # Referrer Policy
                referrer_policy=cloudfront.ResponseHeadersReferrerPolicy(
                    referrer_policy=cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
                    override=True
                ),
                # Content Security Policy (CSP)
                content_security_policy=cloudfront.ResponseHeadersContentSecurityPolicy(
                    content_security_policy=(
                        "default-src 'self'; "
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                        "style-src 'self' 'unsafe-inline'; "
                        "img-src 'self' data: https:; "
                        "font-src 'self' data:; "
                        "connect-src 'self' https:; "
                        "frame-ancestors 'none'; "
                        "base-uri 'self'; "
                        "form-action 'self'"
                    ),
                    override=True
                )
            ),
            # Custom Headers for additional security
            custom_headers_behavior=cloudfront.ResponseCustomHeadersBehavior(
                custom_headers=[
                    cloudfront.ResponseCustomHeader(
                        header="X-Robots-Tag",
                        value="noindex, nofollow",
                        override=True
                    ),
                    cloudfront.ResponseCustomHeader(
                        header="Cache-Control",
                        value="no-cache, no-store, must-revalidate",
                        override=False  # Don't override existing cache headers
                    ),
                    cloudfront.ResponseCustomHeader(
                        header="Permissions-Policy",
                        value="geolocation=(), microphone=(), camera=()",
                        override=True
                    )
                ]
            )
        )

    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for important values."""
        CfnOutput(
            self,
            "BucketName",
            value=self.bucket_name,
            description="S3 bucket name for static assets",
            export_name=f"HealthmateFrontend-{self.props.environment}-BucketName"
        )
        
        CfnOutput(
            self,
            "DistributionId",
            value=self.distribution.distribution_id,
            description="CloudFront distribution ID",
            export_name=f"HealthmateFrontend-{self.props.environment}-DistributionId"
        )
        
        CfnOutput(
            self,
            "DistributionDomainName",
            value=self.distribution_domain_name,
            description="CloudFront distribution domain name",
            export_name=f"HealthmateFrontend-{self.props.environment}-DistributionDomain"
        )
        
        CfnOutput(
            self,
            "WebsiteUrl",
            value=f"https://{self.distribution_domain_name}",
            description="Website URL",
            export_name=f"HealthmateFrontend-{self.props.environment}-WebsiteUrl"
        )