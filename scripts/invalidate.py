#!/usr/bin/env python3
"""
CloudFront Cache Invalidation script for Healthmate Frontend.

This script handles CloudFront cache invalidation with:
- Invalidation request creation
- Progress monitoring
- Batch invalidation support
- Cost optimization (path grouping)
"""

import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional
import argparse
import logging
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    EnvironmentSettings,
    validate_aws_credentials
)


class InvalidationError(Exception):
    """Custom exception for invalidation errors."""
    pass


class CloudFrontInvalidator:
    """CloudFront cache invalidator with progress monitoring."""
    
    def __init__(self, environment: str, verbose: bool = False):
        """
        Initialize the CloudFront invalidator.
        
        Args:
            environment: Target environment (dev/stage/prod)
            verbose: Enable verbose logging
        """
        self.environment = environment
        
        # Setup logging
        log_level = logging.DEBUG if verbose else logging.INFO
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Load environment settings
        try:
            self.settings = EnvironmentSettings.load(environment)
            self.logger.info(f"Loaded settings for environment: {environment}")
        except Exception as e:
            raise InvalidationError(f"Failed to load environment settings: {e}")
        
        # Initialize CloudFront client
        try:
            self.cloudfront_client = boto3.client('cloudfront', region_name=self.settings.aws_region)
            self.logger.info(f"Initialized CloudFront client for region: {self.settings.aws_region}")
        except NoCredentialsError:
            raise InvalidationError("AWS credentials not found. Please configure AWS credentials.")
        except Exception as e:
            raise InvalidationError(f"Failed to initialize CloudFront client: {e}")
    
    def get_distribution_info(self) -> Dict[str, any]:
        """
        Get CloudFront distribution information.
        
        Returns:
            Distribution information dictionary
        """
        try:
            response = self.cloudfront_client.get_distribution(
                Id=self.settings.distribution_id
            )
            
            distribution = response['Distribution']
            config = distribution['DistributionConfig']
            
            return {
                'id': distribution['Id'],
                'domain_name': distribution['DomainName'],
                'status': distribution['Status'],
                'enabled': config['Enabled'],
                'origins': [origin['DomainName'] for origin in config['Origins']],
                'last_modified': distribution['LastModifiedTime']
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'NoSuchDistribution':
                raise InvalidationError(f"Distribution not found: {self.settings.distribution_id}")
            elif error_code == 'AccessDenied':
                raise InvalidationError(f"Access denied to distribution: {self.settings.distribution_id}")
            else:
                raise InvalidationError(f"Error getting distribution info: {error_code}")
        except Exception as e:
            raise InvalidationError(f"Unexpected error getting distribution info: {e}")
    
    def optimize_invalidation_paths(self, paths: List[str]) -> List[str]:
        """
        Optimize invalidation paths to minimize cost.
        
        CloudFront charges per path, so we optimize by:
        1. Using wildcards when beneficial
        2. Removing redundant paths
        3. Grouping similar paths
        
        Args:
            paths: List of paths to invalidate
            
        Returns:
            Optimized list of paths
        """
        if not paths:
            return ['/*']  # Invalidate everything if no specific paths
        
        # Remove duplicates and sort
        unique_paths = sorted(set(paths))
        
        # If we have many paths, use wildcard
        if len(unique_paths) > 10:
            self.logger.info(f"Many paths ({len(unique_paths)}), using wildcard invalidation")
            return ['/*']
        
        # Optimize specific patterns
        optimized = []
        
        for path in unique_paths:
            # Ensure path starts with /
            if not path.startswith('/'):
                path = '/' + path
            
            # Add to optimized list
            optimized.append(path)
        
        # Check if we should use wildcard instead
        if len(optimized) > 5:
            self.logger.info(f"Using wildcard instead of {len(optimized)} individual paths")
            return ['/*']
        
        return optimized
    
    def create_invalidation(self, paths: List[str], caller_reference: Optional[str] = None) -> Dict[str, any]:
        """
        Create a CloudFront invalidation request.
        
        Args:
            paths: List of paths to invalidate
            caller_reference: Unique reference for this invalidation
            
        Returns:
            Invalidation response dictionary
        """
        if not caller_reference:
            caller_reference = f"healthmate-frontend-{self.environment}-{int(time.time())}"
        
        # Optimize paths
        optimized_paths = self.optimize_invalidation_paths(paths)
        
        self.logger.info(f"Creating invalidation for {len(optimized_paths)} paths")
        self.logger.debug(f"Paths to invalidate: {optimized_paths}")
        
        try:
            response = self.cloudfront_client.create_invalidation(
                DistributionId=self.settings.distribution_id,
                InvalidationBatch={
                    'Paths': {
                        'Quantity': len(optimized_paths),
                        'Items': optimized_paths
                    },
                    'CallerReference': caller_reference
                }
            )
            
            invalidation = response['Invalidation']
            
            self.logger.info(f"Invalidation created successfully:")
            self.logger.info(f"  ID: {invalidation['Id']}")
            self.logger.info(f"  Status: {invalidation['Status']}")
            self.logger.info(f"  Paths: {len(optimized_paths)}")
            
            return {
                'success': True,
                'invalidation_id': invalidation['Id'],
                'status': invalidation['Status'],
                'paths': optimized_paths,
                'create_time': invalidation['CreateTime']
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            if error_code == 'TooManyInvalidationsInProgress':
                raise InvalidationError("Too many invalidations in progress. Please wait and try again.")
            elif error_code == 'InvalidArgument':
                raise InvalidationError(f"Invalid invalidation request: {error_message}")
            else:
                raise InvalidationError(f"CloudFront error: {error_code} - {error_message}")
        except Exception as e:
            raise InvalidationError(f"Unexpected error creating invalidation: {e}")
    
    def get_invalidation_status(self, invalidation_id: str) -> Dict[str, any]:
        """
        Get the status of an invalidation request.
        
        Args:
            invalidation_id: ID of the invalidation to check
            
        Returns:
            Invalidation status dictionary
        """
        try:
            response = self.cloudfront_client.get_invalidation(
                DistributionId=self.settings.distribution_id,
                Id=invalidation_id
            )
            
            invalidation = response['Invalidation']
            
            return {
                'id': invalidation['Id'],
                'status': invalidation['Status'],
                'create_time': invalidation['CreateTime'],
                'paths_count': invalidation['InvalidationBatch']['Paths']['Quantity']
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'NoSuchInvalidation':
                raise InvalidationError(f"Invalidation not found: {invalidation_id}")
            else:
                raise InvalidationError(f"Error getting invalidation status: {error_code}")
        except Exception as e:
            raise InvalidationError(f"Unexpected error getting invalidation status: {e}")
    
    def wait_for_invalidation(self, invalidation_id: str, timeout: int = 900) -> bool:
        """
        Wait for an invalidation to complete.
        
        Args:
            invalidation_id: ID of the invalidation to wait for
            timeout: Maximum time to wait in seconds (default: 15 minutes)
            
        Returns:
            True if invalidation completed successfully
        """
        self.logger.info(f"Waiting for invalidation {invalidation_id} to complete...")
        
        start_time = time.time()
        check_interval = 30  # Check every 30 seconds
        
        while time.time() - start_time < timeout:
            try:
                status_info = self.get_invalidation_status(invalidation_id)
                status = status_info['status']
                
                self.logger.debug(f"Invalidation status: {status}")
                
                if status == 'Completed':
                    elapsed = int(time.time() - start_time)
                    self.logger.info(f"✅ Invalidation completed in {elapsed} seconds")
                    return True
                elif status == 'InProgress':
                    elapsed = int(time.time() - start_time)
                    self.logger.info(f"⏳ Invalidation in progress... ({elapsed}s elapsed)")
                else:
                    self.logger.warning(f"Unexpected invalidation status: {status}")
                
                time.sleep(check_interval)
                
            except InvalidationError as e:
                self.logger.error(f"Error checking invalidation status: {e}")
                return False
        
        # Timeout reached
        elapsed = int(time.time() - start_time)
        self.logger.warning(f"⏰ Invalidation timeout after {elapsed} seconds")
        return False
    
    def invalidate(self, paths: Optional[List[str]] = None, wait: bool = False) -> Dict[str, any]:
        """
        Execute the complete invalidation process.
        
        Args:
            paths: List of paths to invalidate (None for all paths)
            wait: Whether to wait for invalidation to complete
            
        Returns:
            Invalidation results dictionary
        """
        try:
            # Verify distribution exists
            dist_info = self.get_distribution_info()
            self.logger.info(f"Target distribution: {dist_info['domain_name']} ({dist_info['status']})")
            
            if not dist_info['enabled']:
                raise InvalidationError("Distribution is not enabled")
            
            # Create invalidation
            if paths is None:
                paths = ['/*']  # Invalidate everything
            
            invalidation_result = self.create_invalidation(paths)
            
            result = {
                'success': True,
                'environment': self.environment,
                'distribution_id': self.settings.distribution_id,
                'distribution_domain': dist_info['domain_name'],
                'invalidation': invalidation_result
            }
            
            # Wait for completion if requested
            if wait:
                self.logger.info("Waiting for invalidation to complete...")
                completed = self.wait_for_invalidation(invalidation_result['invalidation_id'])
                result['completed'] = completed
                
                if not completed:
                    result['warning'] = "Invalidation did not complete within timeout"
            
            return result
            
        except InvalidationError as e:
            self.logger.error(f"Invalidation failed: {e}")
            return {
                'success': False,
                'environment': self.environment,
                'distribution_id': self.settings.distribution_id,
                'error': str(e)
            }
        except Exception as e:
            self.logger.error(f"Unexpected error during invalidation: {e}")
            return {
                'success': False,
                'environment': self.environment,
                'distribution_id': self.settings.distribution_id,
                'error': f"Unexpected error: {e}"
            }


def main():
    """Main entry point for the invalidation script."""
    parser = argparse.ArgumentParser(description='Invalidate CloudFront cache for Healthmate Frontend')
    parser.add_argument(
        'environment',
        choices=['dev', 'stage', 'prod'],
        help='Target environment for the invalidation'
    )
    parser.add_argument(
        '--paths',
        nargs='*',
        help='Specific paths to invalidate (default: all paths)'
    )
    parser.add_argument(
        '--wait',
        action='store_true',
        help='Wait for invalidation to complete'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--validate-aws',
        action='store_true',
        help='Validate AWS credentials before invalidating'
    )
    
    args = parser.parse_args()
    
    # Validate AWS credentials if requested
    if args.validate_aws:
        if not validate_aws_credentials():
            print("ERROR: AWS credentials not configured or invalid")
            print("Please configure AWS credentials using 'aws configure' or environment variables")
            sys.exit(1)
        print("AWS credentials validated successfully")
    
    # Create invalidator and run invalidation
    invalidator = CloudFrontInvalidator(args.environment, args.verbose)
    result = invalidator.invalidate(args.paths, args.wait)
    
    # Print results
    if result['success']:
        print(f"\n✅ Invalidation created successfully")
        print(f"🌍 Environment: {result['environment']}")
        print(f"📡 Distribution: {result['distribution_domain']}")
        
        invalidation = result['invalidation']
        print(f"🔄 Invalidation ID: {invalidation['invalidation_id']}")
        print(f"📁 Paths: {len(invalidation['paths'])}")
        
        if 'completed' in result:
            if result['completed']:
                print("✅ Invalidation completed successfully")
            else:
                print("⏰ Invalidation is still in progress")
        else:
            print("ℹ️  Use --wait to monitor completion")
        
        sys.exit(0)
    else:
        print(f"\n❌ Invalidation failed")
        print(f"Environment: {result['environment']}")
        print(f"Distribution: {result['distribution_id']}")
        print(f"Error: {result['error']}")
        sys.exit(1)


if __name__ == '__main__':
    main()