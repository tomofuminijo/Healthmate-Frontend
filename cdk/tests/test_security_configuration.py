"""
Unit tests for Security Configuration in Healthmate Frontend Hosting Stack.

These tests validate that security settings (HTTPS enforcement, security headers)
are configured correctly according to the requirements specified in the design document.
"""

import sys
from pathlib import Path

# Add parent directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import aws_cdk as cdk
from aws_cdk import assertions

from healthmate_frontend_hosting_stack import HealthmateFrontendHostingStack, HostingStackProps


class TestSecurityConfiguration:
    """Test suite for security configuration validation."""

    @pytest.fixture
    def app(self):
        """Create a CDK app for testing."""
        return cdk.App()

    @pytest.fixture(params=['dev', 'stage', 'prod'])
    def environment(self, request):
        """Parametrized fixture for testing all environments."""
        return request.param

    @pytest.fixture
    def stack_props(self, environment):
        """Create stack properties for testing."""
        return HostingStackProps(environment=environment)

    @pytest.fixture
    def stack(self, app, stack_props):
        """Create a stack instance for testing."""
        return HealthmateFrontendHostingStack(
            app,
            f"TestStack-{stack_props.environment}",
            stack_props
        )

    def test_response_headers_policy_exists(self, stack):
        """
        Test that Response Headers Policy is created.
        
        Requirement 5.2: Security headers (HSTS, X-Content-Type-Options, etc.)
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify that a Response Headers Policy is created
        template.has_resource_properties("AWS::CloudFront::ResponseHeadersPolicy", {})

    def test_hsts_header_configuration(self, stack):
        """
        Test HTTP Strict Transport Security (HSTS) configuration.
        
        Requirement 5.2: Security headers including HSTS
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify HSTS configuration
        template.has_resource_properties("AWS::CloudFront::ResponseHeadersPolicy", {
            "ResponseHeadersPolicyConfig": {
                "SecurityHeadersConfig": {
                    "StrictTransportSecurity": {
                        "AccessControlMaxAgeSec": 31536000,  # 1 year
                        "IncludeSubdomains": True,
                        "Preload": True,
                        "Override": True
                    }
                }
            }
        })

    def test_content_type_options_header(self, stack):
        """
        Test X-Content-Type-Options header configuration.
        
        Requirement 5.2: Security headers including X-Content-Type-Options
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify Content Type Options configuration
        template.has_resource_properties("AWS::CloudFront::ResponseHeadersPolicy", {
            "ResponseHeadersPolicyConfig": {
                "SecurityHeadersConfig": {
                    "ContentTypeOptions": {
                        "Override": True
                    }
                }
            }
        })

    def test_frame_options_header(self, stack):
        """
        Test X-Frame-Options header configuration.
        
        Requirement 5.2: Security headers including frame options
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify Frame Options configuration
        template.has_resource_properties("AWS::CloudFront::ResponseHeadersPolicy", {
            "ResponseHeadersPolicyConfig": {
                "SecurityHeadersConfig": {
                    "FrameOptions": {
                        "FrameOption": "DENY",
                        "Override": True
                    }
                }
            }
        })

    def test_referrer_policy_header(self, stack):
        """
        Test Referrer-Policy header configuration.
        
        Requirement 5.2: Security headers including referrer policy
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify Referrer Policy configuration
        template.has_resource_properties("AWS::CloudFront::ResponseHeadersPolicy", {
            "ResponseHeadersPolicyConfig": {
                "SecurityHeadersConfig": {
                    "ReferrerPolicy": {
                        "ReferrerPolicy": "strict-origin-when-cross-origin",
                        "Override": True
                    }
                }
            }
        })

    def test_content_security_policy_header(self, stack):
        """
        Test Content Security Policy (CSP) header configuration.
        
        Requirement 5.2: Security headers including CSP
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify CSP configuration
        template.has_resource_properties("AWS::CloudFront::ResponseHeadersPolicy", {
            "ResponseHeadersPolicyConfig": {
                "SecurityHeadersConfig": {
                    "ContentSecurityPolicy": {
                        "ContentSecurityPolicy": assertions.Match.string_like_regexp(
                            r"default-src 'self'.*frame-ancestors 'none'.*"
                        ),
                        "Override": True
                    }
                }
            }
        })

    def test_custom_security_headers(self, stack):
        """
        Test custom security headers configuration.
        
        Requirement 5.2: Additional security headers
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify custom headers configuration
        template.has_resource_properties("AWS::CloudFront::ResponseHeadersPolicy", {
            "ResponseHeadersPolicyConfig": {
                "CustomHeadersConfig": {
                    "Items": assertions.Match.array_with([
                        {
                            "Header": "X-Robots-Tag",
                            "Value": "noindex, nofollow",
                            "Override": True
                        },
                        {
                            "Header": "Permissions-Policy",
                            "Value": "geolocation=(), microphone=(), camera=()",
                            "Override": True
                        }
                    ])
                }
            }
        })

    def test_https_enforcement_in_distribution(self, stack):
        """
        Test that CloudFront Distribution enforces HTTPS.
        
        Requirement 5.4: HTTPS enforcement and HTTP to HTTPS redirect
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify HTTPS enforcement in distribution
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "DefaultCacheBehavior": {
                    "ViewerProtocolPolicy": "redirect-to-https"
                }
            }
        })

    def test_security_headers_policy_applied_to_distribution(self, stack):
        """
        Test that security headers policy is applied to CloudFront Distribution.
        
        Requirement 5.2: Security headers must be applied to all responses
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify that distribution uses the response headers policy
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "DefaultCacheBehavior": {
                    "ResponseHeadersPolicyId": assertions.Match.any_value()
                }
            }
        })

    def test_security_headers_policy_naming(self, stack, environment):
        """
        Test that security headers policy follows naming convention.
        
        Requirement: Consistent naming across environments
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify policy name follows convention
        template.has_resource_properties("AWS::CloudFront::ResponseHeadersPolicy", {
            "ResponseHeadersPolicyConfig": {
                "Name": f"healthmate-frontend-security-{environment}",
                "Comment": f"Security headers policy for Healthmate Frontend {environment}"
            }
        })


class TestS3AccessControl:
    """Test suite for S3 access control validation."""

    @pytest.fixture
    def app(self):
        """Create a CDK app for testing."""
        return cdk.App()

    @pytest.fixture
    def stack_props(self):
        """Create stack properties for testing."""
        return HostingStackProps(environment="dev")

    @pytest.fixture
    def stack(self, app, stack_props):
        """Create a stack instance for testing."""
        return HealthmateFrontendHostingStack(
            app,
            "TestStack",
            stack_props
        )

    def test_s3_public_access_blocked(self, stack):
        """
        Test that S3 bucket blocks public access.
        
        Requirement 5.1: S3 bucket access control - block public access
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify public access is blocked
        template.has_resource_properties("AWS::S3::Bucket", {
            "PublicAccessBlockConfiguration": {
                "BlockPublicAcls": True,
                "BlockPublicPolicy": True,
                "IgnorePublicAcls": True,
                "RestrictPublicBuckets": True
            }
        })

    def test_s3_cloudfront_only_access(self, stack):
        """
        Test that S3 bucket allows CloudFront access only.
        
        Requirement 5.1: CloudFront-only access to S3 bucket
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify bucket policy allows CloudFront service access
        template.has_resource_properties("AWS::S3::BucketPolicy", {
            "PolicyDocument": {
                "Statement": assertions.Match.array_with([
                    {
                        "Effect": "Allow",
                        "Principal": {
                            "Service": "cloudfront.amazonaws.com"
                        },
                        "Action": "s3:GetObject",
                        "Resource": assertions.Match.any_value(),
                        "Condition": {
                            "StringEquals": {
                                "AWS:SourceArn": assertions.Match.any_value()
                            }
                        }
                    }
                ])
            }
        })

    def test_origin_access_control_configuration(self, stack):
        """
        Test Origin Access Control (OAC) configuration.
        
        Requirement 5.1: Modern OAC instead of legacy OAI
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify OAC configuration
        template.has_resource_properties("AWS::CloudFront::OriginAccessControl", {
            "OriginAccessControlConfig": {
                "OriginAccessControlOriginType": "s3",
                "SigningBehavior": "always",
                "SigningProtocol": "sigv4"
            }
        })

    def test_s3_encryption_enabled(self, stack):
        """
        Test that S3 bucket has encryption enabled.
        
        Requirement 5.3: Server-side encryption for stored static assets
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify S3 encryption is enabled
        template.has_resource_properties("AWS::S3::Bucket", {
            "BucketEncryption": {
                "ServerSideEncryptionConfiguration": [
                    {
                        "ServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }
                ]
            }
        })