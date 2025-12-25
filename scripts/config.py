"""
Configuration management for Healthmate Frontend deployment scripts.

This module provides configuration loading and validation for deployment scripts.
"""

import os
import json
import boto3
from dataclasses import dataclass
from typing import Dict, Any, Literal, Optional, List
from pathlib import Path


@dataclass
class DeploymentConfig:
    """Configuration for deployment operations."""
    environment: Literal['dev', 'stage', 'prod']
    bucket_name: str
    distribution_id: str
    distribution_domain_name: str
    website_url: str
    region: str
    
    @classmethod
    def from_cloudformation(cls, environment: str, region: str = 'us-west-2') -> 'DeploymentConfig':
        """
        Create deployment config from CloudFormation stack outputs.
        
        Args:
            environment: Target environment (dev/stage/prod)
            region: AWS region
            
        Returns:
            DeploymentConfig instance with values from CloudFormation
        """
        if environment not in ['dev', 'stage', 'prod']:
            raise ValueError(f"Invalid environment: {environment}")
        
        # Initialize CloudFormation client
        cf_client = boto3.client('cloudformation', region_name=region)
        stack_name = f"Healthmate-FrontendStack-{environment}"
        
        # リトライ機能付きでスタック情報を取得
        max_retries = 10
        retry_delay = 2  # 秒
        
        for attempt in range(max_retries):
            try:
                # Get stack outputs
                response = cf_client.describe_stacks(StackName=stack_name)
                stack = response['Stacks'][0]
                outputs = {output['OutputKey']: output['OutputValue'] for output in stack.get('Outputs', [])}
                
                return cls(
                    environment=environment,
                    bucket_name=outputs['BucketName'],
                    distribution_id=outputs['DistributionId'],
                    distribution_domain_name=outputs['DistributionDomainName'],
                    website_url=outputs['WebsiteUrl'],
                    region=region
                )
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"スタック {stack_name} の取得に失敗しました (試行 {attempt + 1}/{max_retries}): {e}")
                    print(f"{retry_delay}秒後にリトライします...")
                    import time
                    time.sleep(retry_delay)
                    retry_delay *= 2  # 指数バックオフ
                else:
                    raise RuntimeError(f"Failed to get CloudFormation outputs for stack {stack_name}: {e}")


@dataclass
class EnvironmentSettings:
    """Environment-specific settings loaded from JSON configuration files."""
    environment: str
    aws_region: str
    aws_profile: Optional[str]
    build_mode: str
    build_sourcemap: bool
    build_minify: bool
    deployment_confirm: bool
    deployment_cache_invalidation: bool
    deployment_concurrency: int
    deployment_retry_attempts: int
    monitoring_logging: bool
    monitoring_log_level: str
    
    @classmethod
    def load(cls, environment: str) -> 'EnvironmentSettings':
        """
        Load environment settings from JSON configuration file.
        
        Args:
            environment: Target environment (dev/stage/prod)
            
        Returns:
            EnvironmentSettings instance
        """
        if environment not in ['dev', 'stage', 'prod']:
            raise ValueError(f"Invalid environment: {environment}")
        
        config_file = get_project_root() / 'scripts' / 'environments' / f'{environment}.json'
        
        if not config_file.exists():
            raise FileNotFoundError(f"Environment config file not found: {config_file}")
        
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
            
            return cls(
                environment=config['environment'],
                aws_region=os.environ.get('AWS_REGION', config['aws']['region']),  # 環境変数を優先
                aws_profile=config['aws']['profile'],
                build_mode=config['build']['mode'],
                build_sourcemap=config['build']['sourcemap'],
                build_minify=config['build']['minify'],
                deployment_confirm=config['deployment']['confirm_before_deploy'],
                deployment_cache_invalidation=config['deployment']['enable_cache_invalidation'],
                deployment_concurrency=config['deployment']['upload_concurrency'],
                deployment_retry_attempts=config['deployment']['retry_attempts'],
                monitoring_logging=config['monitoring']['enable_logging'],
                monitoring_log_level=config['monitoring']['log_level']
            )
        except (json.JSONDecodeError, KeyError) as e:
            raise ValueError(f"Invalid environment config file {config_file}: {e}")


@dataclass
class DeploymentResult:
    """Result of a deployment operation."""
    success: bool
    distribution_url: str
    uploaded_files: int
    invalidation_id: Optional[str] = None
    errors: Optional[List[str]] = None


def get_environment_config(environment: str) -> Dict[str, Any]:
    """
    Get environment-specific configuration for CDK deployment.
    
    Args:
        environment: Target environment (dev/stage/prod)
        
    Returns:
        Dictionary containing environment configuration
    """
    if environment not in ['dev', 'stage', 'prod']:
        raise ValueError(f"Invalid environment: {environment}. Must be one of: dev, stage, prod")
    
    return {
        'region': os.environ.get('AWS_REGION', 'us-west-2'),
        'environment': environment,
        'bucket_prefix': f'healthmate-frontend-{environment}',
        'tags': {
            'Environment': environment,
            'Service': 'healthmate-frontend',
            'CostCenter': 'healthmate',
            'ManagedBy': 'CDK'
        }
    }


def validate_aws_credentials() -> bool:
    """
    Validate that AWS credentials are properly configured.
    
    Returns:
        True if credentials are available, False otherwise
    """
    try:
        # Try to create a session and get caller identity
        session = boto3.Session()
        sts_client = session.client('sts')
        sts_client.get_caller_identity()
        return True
    except Exception:
        return False


def get_aws_account_info() -> Dict[str, str]:
    """
    Get AWS account information for validation.
    
    Returns:
        Dictionary containing account ID, user ARN, and user ID
    """
    try:
        sts_client = boto3.client('sts')
        response = sts_client.get_caller_identity()
        return {
            'account_id': response.get('Account', ''),
            'user_arn': response.get('Arn', ''),
            'user_id': response.get('UserId', '')
        }
    except Exception as e:
        raise RuntimeError(f"Failed to get AWS account information: {e}")


def validate_aws_permissions(region: str = 'us-west-2') -> Dict[str, bool]:
    """
    Validate that the current AWS credentials have required permissions.
    
    Args:
        region: AWS region to test permissions in
        
    Returns:
        Dictionary indicating which permissions are available
    """
    permissions = {
        'cloudformation': False,
        's3': False,
        'cloudfront': False
    }
    
    try:
        # Test CloudFormation permissions
        cf_client = boto3.client('cloudformation', region_name=region)
        cf_client.list_stacks(MaxItems=1)
        permissions['cloudformation'] = True
    except Exception:
        pass
    
    try:
        # Test S3 permissions
        s3_client = boto3.client('s3', region_name=region)
        s3_client.list_buckets()
        permissions['s3'] = True
    except Exception:
        pass
    
    try:
        # Test CloudFront permissions
        cf_client = boto3.client('cloudfront', region_name=region)
        cf_client.list_distributions(MaxItems=1)
        permissions['cloudfront'] = True
    except Exception:
        pass
    
    return permissions


def get_project_root() -> Path:
    """
    Get the project root directory (Healthmate-Frontend).
    
    Returns:
        Path to the project root directory
    """
    current_file = Path(__file__)
    # Go up from scripts/config.py to Healthmate-Frontend/
    return current_file.parent.parent


def get_dist_directory() -> Path:
    """
    Get the dist directory path where Vite builds output.
    
    Returns:
        Path to the dist directory
    """
    return get_project_root() / 'dist'


def get_cdk_directory() -> Path:
    """
    Get the CDK directory path.
    
    Returns:
        Path to the CDK directory
    """
    return get_project_root() / 'cdk'