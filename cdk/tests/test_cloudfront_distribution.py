"""
Unit tests for CloudFront Distribution configuration in Healthmate Frontend Hosting Stack.

These tests validate that the CloudFront Distribution is configured correctly according to
the requirements specified in the design document.
"""

import sys
from pathlib import Path

# Add parent directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import aws_cdk as cdk
from aws_cdk import assertions

from healthmate_frontend_hosting_stack import HealthmateFrontendHostingStack, HostingStackProps


class TestCloudFrontDistribution:
    """Test suite for CloudFront Distribution configuration validation."""

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

    def test_distribution_exists(self, stack):
        """Test that CloudFront Distribution is created."""
        template = assertions.Template.from_stack(stack)
        
        # Verify that a CloudFront Distribution is created
        template.has_resource_properties("AWS::CloudFront::Distribution", {})

    def test_distribution_s3_origin(self, stack):
        """
        Test that CloudFront Distribution uses S3 bucket as origin.
        
        Requirement 2.1: THE CDK_Stack SHALL create a CloudFront_Distribution 
        that points to the S3_Bucket as origin
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify S3 origin configuration
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "Origins": [
                    {
                        "DomainName": assertions.Match.any_value(),
                        "Id": assertions.Match.any_value(),
                        "OriginAccessControlId": assertions.Match.any_value(),
                        "S3OriginConfig": {
                            "OriginAccessIdentity": ""
                        }
                    }
                ]
            }
        })

    def test_distribution_caching_behavior(self, stack):
        """
        Test that CloudFront Distribution has no-cache behavior.
        
        CloudFront is used only as HTTPS entry point, not for caching.
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify default cache behavior uses no-cache policy
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "DefaultCacheBehavior": {
                    "AllowedMethods": ["GET", "HEAD", "OPTIONS"],
                    "CachedMethods": ["GET", "HEAD", "OPTIONS"],
                    "CachePolicyId": assertions.Match.any_value(),
                    "Compress": True,
                    "ViewerProtocolPolicy": "redirect-to-https"
                }
            }
        })

    def test_no_cache_policy_exists(self, stack):
        """
        Test that a no-cache policy is created.
        
        CloudFront should not cache any content since it's used only as HTTPS entry point.
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify no-cache policy exists
        template.has_resource_properties("AWS::CloudFront::CachePolicy", {
            "CachePolicyConfig": {
                "DefaultTTL": 0,
                "MaxTTL": 0,
                "MinTTL": 0,
                "ParametersInCacheKeyAndForwardedToOrigin": {
                    "QueryStringsConfig": {
                        "QueryStringBehavior": "none"
                    },
                    "HeadersConfig": {
                        "HeaderBehavior": "none"
                    },
                    "CookiesConfig": {
                        "CookieBehavior": "none"
                    }
                }
            }
        })

    def test_distribution_spa_routing(self, stack):
        """
        Test that CloudFront Distribution supports SPA routing.
        
        Requirement 2.3: WHEN a request is made to CloudFront_Distribution, 
        THE CloudFront_Distribution SHALL serve index.html for SPA routing 
        (404 errors redirect to index.html)
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify custom error responses for SPA routing
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "CustomErrorResponses": [
                    {
                        "ErrorCode": 404,
                        "ResponseCode": 200,
                        "ResponsePagePath": "/index.html",
                        "ErrorCachingMinTTL": 300
                    },
                    {
                        "ErrorCode": 403,
                        "ResponseCode": 200,
                        "ResponsePagePath": "/index.html",
                        "ErrorCachingMinTTL": 300
                    }
                ]
            }
        })

    def test_distribution_compression(self, stack):
        """
        Test that CloudFront Distribution enables compression.
        
        Requirement 2.4: THE CloudFront_Distribution SHALL compress Static_Assets 
        automatically for better performance
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify compression is enabled
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "DefaultCacheBehavior": {
                    "Compress": True
                }
            }
        })

    def test_distribution_https_redirect(self, stack):
        """
        Test that CloudFront Distribution redirects HTTP to HTTPS.
        
        Requirement 5.4: THE CloudFront_Distribution SHALL only allow HTTPS 
        connections and redirect HTTP to HTTPS
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify HTTPS redirect
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "DefaultCacheBehavior": {
                    "ViewerProtocolPolicy": "redirect-to-https"
                }
            }
        })

    def test_distribution_default_root_object(self, stack):
        """Test that CloudFront Distribution has correct default root object."""
        template = assertions.Template.from_stack(stack)
        
        # Verify default root object
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "DefaultRootObject": "index.html"
            }
        })

    def test_distribution_enabled(self, stack):
        """Test that CloudFront Distribution is enabled."""
        template = assertions.Template.from_stack(stack)
        
        # Verify distribution is enabled
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "Enabled": True
            }
        })

    def test_distribution_price_class(self, stack):
        """
        Test that CloudFront Distribution uses cost-effective price class.
        
        Requirement 7.2: THE CloudFront_Distribution SHALL use appropriate 
        price class for testing (PriceClass_100 for US/Europe)
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify price class for cost optimization
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "PriceClass": "PriceClass_100"
            }
        })

    def test_distribution_comment(self, stack, environment):
        """Test that CloudFront Distribution has appropriate comment."""
        template = assertions.Template.from_stack(stack)
        
        # Verify distribution comment includes environment
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "DistributionConfig": {
                "Comment": f"Healthmate Frontend Distribution - {environment}"
            }
        })

    def test_origin_access_control_exists(self, stack):
        """Test that Origin Access Control is created."""
        template = assertions.Template.from_stack(stack)
        
        # Verify Origin Access Control resource exists
        template.has_resource_properties("AWS::CloudFront::OriginAccessControl", {
            "OriginAccessControlConfig": {
                "OriginAccessControlOriginType": "s3",
                "SigningBehavior": "always",
                "SigningProtocol": "sigv4"
            }
        })

    def test_distribution_tags(self, stack, environment):
        """Test that CloudFront Distribution has appropriate tags."""
        template = assertions.Template.from_stack(stack)
        
        # Verify distribution has required tags
        template.has_resource_properties("AWS::CloudFront::Distribution", {
            "Tags": assertions.Match.array_with([
                {"Key": "Environment", "Value": environment},
                {"Key": "Service", "Value": "healthmate-frontend"}
            ])
        })


class TestCloudFrontOutputs:
    """Test suite for CloudFront-related CloudFormation outputs."""

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

    def test_distribution_outputs(self, stack):
        """
        Test that required CloudFormation outputs are created.
        
        Requirement 2.5: WHEN the CloudFront_Distribution is created, THE CDK_Stack 
        SHALL output the distribution domain name for access
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify distribution ID output
        template.has_output("DistributionId", {
            "Description": "CloudFront distribution ID"
        })
        
        # Verify distribution domain name output
        template.has_output("DistributionDomainName", {
            "Description": "CloudFront distribution domain name"
        })
        
        # Verify website URL output
        template.has_output("WebsiteUrl", {
            "Description": "Website URL"
        })