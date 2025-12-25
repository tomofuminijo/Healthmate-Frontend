"""
Unit tests for S3 bucket configuration in Healthmate Frontend Hosting Stack.

These tests validate that the S3 bucket is configured correctly according to
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


class TestS3BucketConfiguration:
    """Test suite for S3 bucket configuration validation."""

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

    def test_bucket_exists(self, stack):
        """Test that S3 bucket is created."""
        template = assertions.Template.from_stack(stack)
        
        # Verify that an S3 bucket is created
        template.has_resource_properties("AWS::S3::Bucket", {})

    def test_bucket_naming_convention(self, stack, environment):
        """
        Test that bucket name follows the required pattern.
        
        Requirement 1.4: THE S3_Bucket SHALL have a unique name following 
        the pattern "healthmate-frontend-{environment}-{random-suffix}"
        """
        expected_prefix = f"healthmate-frontend-{environment}-"
        
        # Check that bucket name starts with the correct pattern
        assert stack.bucket_name.startswith(expected_prefix)
        
        # Check that there's a suffix after the prefix
        suffix = stack.bucket_name[len(expected_prefix):]
        assert len(suffix) > 0
        assert len(suffix) == 8  # UUID suffix should be 8 characters
        
        # Check total bucket name length is valid for S3
        assert 3 <= len(stack.bucket_name) <= 63

    def test_bucket_versioning_enabled(self, stack):
        """
        Test that S3 bucket versioning is enabled.
        
        Requirement 1.5: WHEN the S3_Bucket is created, THE CDK_Stack SHALL 
        enable versioning for deployment rollback capability
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify versioning is enabled
        template.has_resource_properties("AWS::S3::Bucket", {
            "VersioningConfiguration": {
                "Status": "Enabled"
            }
        })

    def test_bucket_encryption_enabled(self, stack):
        """
        Test that S3 bucket has server-side encryption enabled.
        
        Requirement 5.3: THE S3_Bucket SHALL use server-side encryption 
        for stored Static_Assets
        """
        template = assertions.Template.from_stack(stack)
        
        # Verify encryption is configured
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

    def test_bucket_public_access_blocked(self, stack):
        """
        Test that S3 bucket blocks public access appropriately.
        
        Requirement 5.1: THE S3_Bucket SHALL block public access to 
        non-website endpoints while allowing CloudFront access
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

    def test_bucket_lifecycle_configuration(self, stack):
        """Test that S3 bucket has lifecycle rules for cost optimization."""
        template = assertions.Template.from_stack(stack)
        
        # Verify lifecycle configuration exists with correct structure
        template.has_resource_properties("AWS::S3::Bucket", {
            "LifecycleConfiguration": {
                "Rules": [
                    {
                        "Id": "DeleteOldVersions",
                        "Status": "Enabled",
                        "NoncurrentVersionExpiration": {
                            "NoncurrentDays": 30
                        },
                        "AbortIncompleteMultipartUpload": {
                            "DaysAfterInitiation": 1
                        }
                    }
                ]
            }
        })

    def test_bucket_tags(self, stack, environment):
        """Test that S3 bucket has appropriate tags."""
        template = assertions.Template.from_stack(stack)
        
        # Verify bucket has the essential tags that we actually set
        template.has_resource_properties("AWS::S3::Bucket", {
            "Tags": assertions.Match.array_with([
                {"Key": "Environment", "Value": environment},
                {"Key": "Service", "Value": "healthmate-frontend"}
            ])
        })

    def test_cloudformation_outputs(self, stack, environment):
        """Test that required CloudFormation outputs are created."""
        template = assertions.Template.from_stack(stack)
        
        # Verify bucket name output
        template.has_output("BucketName", {
            "Description": "S3 bucket name for static assets",
            "Export": {
                "Name": f"HealthmateFrontend-{environment}-BucketName"
            }
        })


class TestS3BucketValidation:
    """Test suite for S3 bucket validation logic."""

    def test_invalid_environment_raises_error(self):
        """Test that invalid environment raises ValueError."""
        app = cdk.App()
        
        # Test that invalid environment raises ValueError during props creation
        with pytest.raises(ValueError, match="Invalid environment 'invalid'"):
            props = HostingStackProps(environment="invalid")  # type: ignore

    def test_bucket_name_validation(self):
        """Test bucket name validation logic."""
        app = cdk.App()
        props = HostingStackProps(environment="dev")
        stack = HealthmateFrontendHostingStack(app, "TestStack", props)
        
        # Bucket name should follow the pattern
        expected_pattern = "healthmate-frontend-dev-"
        assert stack.bucket_name.startswith(expected_pattern)
        
        # Should have 8-character suffix
        suffix = stack.bucket_name[len(expected_pattern):]
        assert len(suffix) == 8
        
        # Should be valid S3 bucket name length
        assert 3 <= len(stack.bucket_name) <= 63