"""
Unit tests for deployment configuration management.
"""

import os
import json
import pytest
from unittest.mock import patch, mock_open, MagicMock
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    DeploymentConfig, 
    EnvironmentSettings, 
    DeploymentResult,
    get_environment_config,
    validate_aws_credentials,
    get_aws_account_info,
    validate_aws_permissions,
    get_project_root,
    get_dist_directory,
    get_cdk_directory
)


class TestDeploymentConfig:
    """Test suite for DeploymentConfig class."""
    
    def test_from_cloudformation_success(self):
        """Test successful CloudFormation config creation."""
        mock_outputs = [
            {'OutputKey': 'BucketName', 'OutputValue': 'test-bucket'},
            {'OutputKey': 'DistributionId', 'OutputValue': 'E123456789'},
            {'OutputKey': 'DistributionDomainName', 'OutputValue': 'd123.cloudfront.net'},
            {'OutputKey': 'WebsiteUrl', 'OutputValue': 'https://d123.cloudfront.net'}
        ]
        
        with patch('boto3.client') as mock_boto3:
            mock_cf = MagicMock()
            mock_cf.describe_stacks.return_value = {
                'Stacks': [{'Outputs': mock_outputs}]
            }
            mock_boto3.return_value = mock_cf
            
            config = DeploymentConfig.from_cloudformation('dev')
            
            assert config.environment == 'dev'
            assert config.bucket_name == 'test-bucket'
            assert config.distribution_id == 'E123456789'
            assert config.distribution_domain_name == 'd123.cloudfront.net'
            assert config.website_url == 'https://d123.cloudfront.net'
            assert config.region == 'us-west-2'
    
    def test_from_cloudformation_invalid_environment(self):
        """Test CloudFormation config with invalid environment."""
        with pytest.raises(ValueError, match="Invalid environment"):
            DeploymentConfig.from_cloudformation('invalid')
    
    def test_from_cloudformation_stack_not_found(self):
        """Test CloudFormation config when stack doesn't exist."""
        with patch('boto3.client') as mock_boto3:
            mock_cf = MagicMock()
            mock_cf.describe_stacks.side_effect = Exception("Stack not found")
            mock_boto3.return_value = mock_cf
            
            with pytest.raises(RuntimeError, match="Failed to get CloudFormation outputs"):
                DeploymentConfig.from_cloudformation('dev')
    
    def test_from_environment_success(self):
        """Test environment variable config creation."""
        env_vars = {
            'HEALTHMATE_FRONTEND_DEV_BUCKET_NAME': 'env-bucket',
            'HEALTHMATE_FRONTEND_DEV_DISTRIBUTION_ID': 'E987654321',
            'HEALTHMATE_FRONTEND_DEV_DISTRIBUTION_DOMAIN': 'd987.cloudfront.net',
            'AWS_REGION': 'us-east-1'
        }
        
        with patch.dict(os.environ, env_vars):
            config = DeploymentConfig.from_environment('dev')
            
            assert config.environment == 'dev'
            assert config.bucket_name == 'env-bucket'
            assert config.distribution_id == 'E987654321'
            assert config.distribution_domain_name == 'd987.cloudfront.net'
            assert config.website_url == 'https://d987.cloudfront.net'
            assert config.region == 'us-east-1'


class TestEnvironmentSettings:
    """Test suite for EnvironmentSettings class."""
    
    def test_load_dev_config(self):
        """Test loading development environment config."""
        mock_config = {
            "environment": "dev",
            "aws": {"region": "us-west-2", "profile": None},
            "build": {"mode": "development", "sourcemap": True, "minify": False},
            "deployment": {
                "confirm_before_deploy": False,
                "enable_cache_invalidation": True,
                "upload_concurrency": 10,
                "retry_attempts": 3
            },
            "monitoring": {"enable_logging": True, "log_level": "DEBUG"}
        }
        
        with patch('builtins.open', mock_open(read_data=json.dumps(mock_config))):
            with patch('pathlib.Path.exists', return_value=True):
                settings = EnvironmentSettings.load('dev')
                
                assert settings.environment == 'dev'
                assert settings.aws_region == 'us-west-2'
                assert settings.build_mode == 'development'
                assert settings.build_sourcemap is True
                assert settings.build_minify is False
                assert settings.deployment_confirm is False
                assert settings.monitoring_log_level == 'DEBUG'
    
    def test_load_invalid_environment(self):
        """Test loading config with invalid environment."""
        with pytest.raises(ValueError, match="Invalid environment"):
            EnvironmentSettings.load('invalid')
    
    def test_load_missing_config_file(self):
        """Test loading config when file doesn't exist."""
        with patch('pathlib.Path.exists', return_value=False):
            with pytest.raises(FileNotFoundError, match="Environment config file not found"):
                EnvironmentSettings.load('dev')
    
    def test_load_invalid_json(self):
        """Test loading config with invalid JSON."""
        with patch('builtins.open', mock_open(read_data='invalid json')):
            with patch('pathlib.Path.exists', return_value=True):
                with pytest.raises(ValueError, match="Invalid environment config file"):
                    EnvironmentSettings.load('dev')


class TestConfigurationFunctions:
    """Test suite for configuration utility functions."""
    
    def test_get_environment_config_valid(self):
        """Test getting valid environment configuration."""
        with patch.dict(os.environ, {'AWS_REGION': 'us-east-1'}):
            config = get_environment_config('dev')
            
            assert config['environment'] == 'dev'
            assert config['region'] == 'us-east-1'
            assert config['bucket_prefix'] == 'healthmate-frontend-dev'
            assert config['tags']['Environment'] == 'dev'
    
    def test_get_environment_config_invalid(self):
        """Test getting configuration with invalid environment."""
        with pytest.raises(ValueError, match="Invalid environment"):
            get_environment_config('invalid')
    
    def test_validate_aws_credentials_success(self):
        """Test AWS credentials validation success."""
        with patch('boto3.Session') as mock_session:
            mock_sts = MagicMock()
            mock_sts.get_caller_identity.return_value = {'Account': '123456789012'}
            mock_session.return_value.client.return_value = mock_sts
            
            assert validate_aws_credentials() is True
    
    def test_validate_aws_credentials_failure(self):
        """Test AWS credentials validation failure."""
        with patch('boto3.Session') as mock_session:
            mock_session.side_effect = Exception("No credentials")
            
            assert validate_aws_credentials() is False
    
    def test_get_aws_account_info_success(self):
        """Test getting AWS account information."""
        mock_response = {
            'Account': '123456789012',
            'Arn': 'arn:aws:iam::123456789012:user/test',
            'UserId': 'AIDACKCEVSQ6C2EXAMPLE'
        }
        
        with patch('boto3.client') as mock_boto3:
            mock_sts = MagicMock()
            mock_sts.get_caller_identity.return_value = mock_response
            mock_boto3.return_value = mock_sts
            
            info = get_aws_account_info()
            
            assert info['account_id'] == '123456789012'
            assert info['user_arn'] == 'arn:aws:iam::123456789012:user/test'
            assert info['user_id'] == 'AIDACKCEVSQ6C2EXAMPLE'
    
    def test_validate_aws_permissions_all_success(self):
        """Test AWS permissions validation with all permissions."""
        with patch('boto3.client') as mock_boto3:
            mock_client = MagicMock()
            mock_client.list_stacks.return_value = {}
            mock_client.list_buckets.return_value = {}
            mock_client.list_distributions.return_value = {}
            mock_boto3.return_value = mock_client
            
            permissions = validate_aws_permissions()
            
            assert permissions['cloudformation'] is True
            assert permissions['s3'] is True
            assert permissions['cloudfront'] is True
    
    def test_get_project_paths(self):
        """Test project path utility functions."""
        # These functions depend on file structure, so we test they return Path objects
        assert isinstance(get_project_root(), Path)
        assert isinstance(get_dist_directory(), Path)
        assert isinstance(get_cdk_directory(), Path)


class TestDeploymentResult:
    """Test suite for DeploymentResult dataclass."""
    
    def test_deployment_result_success(self):
        """Test successful deployment result."""
        result = DeploymentResult(
            success=True,
            distribution_url="https://d123.cloudfront.net",
            uploaded_files=25,
            invalidation_id="I123456789",
            errors=None
        )
        
        assert result.success is True
        assert result.distribution_url == "https://d123.cloudfront.net"
        assert result.uploaded_files == 25
        assert result.invalidation_id == "I123456789"
        assert result.errors is None
    
    def test_deployment_result_failure(self):
        """Test failed deployment result."""
        result = DeploymentResult(
            success=False,
            distribution_url="",
            uploaded_files=0,
            errors=["Upload failed", "Invalid credentials"]
        )
        
        assert result.success is False
        assert result.uploaded_files == 0
        assert len(result.errors) == 2