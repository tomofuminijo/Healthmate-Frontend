#!/usr/bin/env python3
"""
S3 Upload script for Healthmate Frontend.

This script handles uploading build artifacts to S3 with:
- MIME type detection and setting
- Upload progress tracking
- File integrity verification
- Parallel uploads for performance
"""

import os
import sys
import mimetypes
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import argparse
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    EnvironmentSettings,
    DeploymentConfig,
    get_project_root,
    get_dist_directory,
    validate_aws_credentials
)


class UploadError(Exception):
    """Custom exception for upload errors."""
    pass


class S3Uploader:
    """S3 uploader with progress tracking and MIME type handling."""
    
    def __init__(self, environment: str, verbose: bool = False):
        """
        Initialize the S3 uploader.
        
        Args:
            environment: Target environment (dev/stage/prod)
            verbose: Enable verbose logging
        """
        self.environment = environment
        self.project_root = get_project_root()
        self.dist_dir = get_dist_directory()
        
        # Setup logging
        log_level = logging.DEBUG if verbose else logging.INFO
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Load environment settings and deployment config
        try:
            self.settings = EnvironmentSettings.load(environment)
            self.deployment_config = DeploymentConfig.from_cloudformation(environment, self.settings.aws_region)
            self.logger.info(f"Loaded settings for environment: {environment}")
        except Exception as e:
            raise UploadError(f"Failed to load environment settings: {e}")
        
        # Initialize S3 client
        try:
            self.s3_client = boto3.client('s3', region_name=self.deployment_config.region)
            self.logger.info(f"Initialized S3 client for region: {self.deployment_config.region}")
        except NoCredentialsError:
            raise UploadError("AWS credentials not found. Please configure AWS credentials.")
        except Exception as e:
            raise UploadError(f"Failed to initialize S3 client: {e}")
    
    def get_mime_type(self, file_path: Path) -> str:
        """
        Get MIME type for a file.
        
        Args:
            file_path: Path to the file
            
        Returns:
            MIME type string
        """
        mime_type, _ = mimetypes.guess_type(str(file_path))
        
        if mime_type:
            return mime_type
        
        # Custom MIME types for common web files
        suffix = file_path.suffix.lower()
        custom_types = {
            '.js': 'application/javascript',
            '.mjs': 'application/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.ico': 'image/x-icon',
            '.webp': 'image/webp',
            '.avif': 'image/avif'
        }
        
        return custom_types.get(suffix, 'application/octet-stream')
    
    def get_cache_control(self, file_path: Path) -> str:
        """
        Get appropriate Cache-Control header for a file.
        
        Since CloudFront caching is disabled, we set no-cache for all files.
        
        Args:
            file_path: Path to the file
            
        Returns:
            Cache-Control header value
        """
        # CloudFront caching is disabled, so set no-cache for all files
        return 'no-cache, no-store, must-revalidate'
    
    def calculate_file_hash(self, file_path: Path) -> str:
        """
        Calculate MD5 hash of a file for integrity verification.
        
        Args:
            file_path: Path to the file
            
        Returns:
            MD5 hash as hex string
        """
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def upload_file(self, local_path: Path, s3_key: str) -> Dict[str, any]:
        """
        Upload a single file to S3.
        
        Args:
            local_path: Local file path
            s3_key: S3 object key
            
        Returns:
            Upload result dictionary
        """
        try:
            # Get file info
            file_size = local_path.stat().st_size
            mime_type = self.get_mime_type(local_path)
            cache_control = self.get_cache_control(local_path)
            file_hash = self.calculate_file_hash(local_path)
            
            # Prepare upload parameters
            extra_args = {
                'ContentType': mime_type,
                'CacheControl': cache_control,
                'Metadata': {
                    'original-name': local_path.name,
                    'upload-hash': file_hash
                }
            }
            
            # Note: Do not set ContentEncoding=gzip unless files are actually gzip compressed
            # Vite build output is not pre-compressed, so we don't set ContentEncoding
            
            self.logger.debug(f"Uploading {local_path} -> s3://{self.deployment_config.bucket_name}/{s3_key}")
            self.logger.debug(f"  MIME type: {mime_type}")
            self.logger.debug(f"  Cache-Control: {cache_control}")
            self.logger.debug(f"  Size: {file_size} bytes")
            
            # Upload file
            self.s3_client.upload_file(
                str(local_path),
                self.deployment_config.bucket_name,
                s3_key,
                ExtraArgs=extra_args
            )
            
            return {
                'success': True,
                'local_path': str(local_path),
                's3_key': s3_key,
                'size': file_size,
                'mime_type': mime_type,
                'hash': file_hash
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            self.logger.error(f"S3 upload failed for {local_path}: {error_code} - {error_message}")
            
            return {
                'success': False,
                'local_path': str(local_path),
                's3_key': s3_key,
                'error': f"{error_code}: {error_message}"
            }
        except Exception as e:
            self.logger.error(f"Unexpected error uploading {local_path}: {e}")
            return {
                'success': False,
                'local_path': str(local_path),
                's3_key': s3_key,
                'error': str(e)
            }
    
    def get_files_to_upload(self) -> List[Tuple[Path, str]]:
        """
        Get list of files to upload with their S3 keys.
        
        Returns:
            List of (local_path, s3_key) tuples
        """
        if not self.dist_dir.exists():
            raise UploadError(f"Build directory not found: {self.dist_dir}")
        
        files_to_upload = []
        
        for file_path in self.dist_dir.rglob('*'):
            if file_path.is_file():
                # Calculate relative path for S3 key
                relative_path = file_path.relative_to(self.dist_dir)
                s3_key = str(relative_path).replace('\\', '/')  # Ensure forward slashes
                
                files_to_upload.append((file_path, s3_key))
        
        return files_to_upload
    
    def verify_bucket_exists(self) -> bool:
        """
        Verify that the target S3 bucket exists and is accessible.
        
        Returns:
            True if bucket exists and is accessible
        """
        try:
            self.s3_client.head_bucket(Bucket=self.deployment_config.bucket_name)
            self.logger.info(f"Verified bucket exists: {self.deployment_config.bucket_name}")
            return True
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                self.logger.error(f"Bucket not found: {self.deployment_config.bucket_name}")
            elif error_code == '403':
                self.logger.error(f"Access denied to bucket: {self.deployment_config.bucket_name}")
            else:
                self.logger.error(f"Error accessing bucket {self.deployment_config.bucket_name}: {error_code}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error checking bucket: {e}")
            return False
    
    def upload_files(self, max_workers: int = 5) -> Dict[str, any]:
        """
        Upload all files to S3 with parallel processing.
        
        Args:
            max_workers: Maximum number of parallel upload threads
            
        Returns:
            Upload results dictionary
        """
        self.logger.info("Starting S3 upload process...")
        
        # Verify bucket exists
        if not self.verify_bucket_exists():
            raise UploadError(f"Cannot access S3 bucket: {self.deployment_config.bucket_name}")
        
        # Get files to upload
        files_to_upload = self.get_files_to_upload()
        
        if not files_to_upload:
            raise UploadError("No files found to upload")
        
        self.logger.info(f"Found {len(files_to_upload)} files to upload")
        
        # Upload files in parallel
        results = {
            'successful_uploads': [],
            'failed_uploads': [],
            'total_files': len(files_to_upload),
            'total_size': 0
        }
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all upload tasks
            future_to_file = {
                executor.submit(self.upload_file, local_path, s3_key): (local_path, s3_key)
                for local_path, s3_key in files_to_upload
            }
            
            # Process completed uploads
            for future in as_completed(future_to_file):
                local_path, s3_key = future_to_file[future]
                
                try:
                    result = future.result()
                    
                    if result['success']:
                        results['successful_uploads'].append(result)
                        results['total_size'] += result['size']
                        self.logger.info(f"✅ Uploaded: {s3_key}")
                    else:
                        results['failed_uploads'].append(result)
                        self.logger.error(f"❌ Failed: {s3_key} - {result['error']}")
                        
                except Exception as e:
                    error_result = {
                        'success': False,
                        'local_path': str(local_path),
                        's3_key': s3_key,
                        'error': str(e)
                    }
                    results['failed_uploads'].append(error_result)
                    self.logger.error(f"❌ Exception: {s3_key} - {e}")
        
        # Calculate statistics
        success_count = len(results['successful_uploads'])
        failure_count = len(results['failed_uploads'])
        success_rate = (success_count / results['total_files']) * 100 if results['total_files'] > 0 else 0
        
        results['success_count'] = success_count
        results['failure_count'] = failure_count
        results['success_rate'] = success_rate
        results['total_size_mb'] = round(results['total_size'] / (1024 * 1024), 2)
        
        self.logger.info(f"Upload completed: {success_count}/{results['total_files']} files ({success_rate:.1f}%)")
        self.logger.info(f"Total size uploaded: {results['total_size_mb']} MB")
        
        if failure_count > 0:
            self.logger.warning(f"{failure_count} files failed to upload")
        
        return results
    
    def upload(self, max_workers: int = 5) -> Dict[str, any]:
        """
        Execute the complete upload process.
        
        Args:
            max_workers: Maximum number of parallel upload threads
            
        Returns:
            Upload results dictionary
        """
        try:
            results = self.upload_files(max_workers)
            
            if results['failure_count'] > 0:
                return {
                    'success': False,
                    'environment': self.environment,
                    'bucket': self.deployment_config.bucket_name,
                    'results': results,
                    'error': f"{results['failure_count']} files failed to upload"
                }
            
            return {
                'success': True,
                'environment': self.environment,
                'bucket': self.deployment_config.bucket_name,
                'results': results
            }
            
        except UploadError as e:
            self.logger.error(f"Upload failed: {e}")
            return {
                'success': False,
                'environment': self.environment,
                'bucket': self.deployment_config.bucket_name,
                'error': str(e)
            }
        except Exception as e:
            self.logger.error(f"Unexpected error during upload: {e}")
            return {
                'success': False,
                'environment': self.environment,
                'bucket': self.deployment_config.bucket_name,
                'error': f"Unexpected error: {e}"
            }


def main():
    """Main entry point for the upload script."""
    parser = argparse.ArgumentParser(description='Upload Healthmate Frontend to S3')
    parser.add_argument(
        'environment',
        choices=['dev', 'stage', 'prod'],
        help='Target environment for the upload'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    parser.add_argument(
        '--max-workers',
        type=int,
        default=5,
        help='Maximum number of parallel upload threads (default: 5)'
    )
    parser.add_argument(
        '--validate-aws',
        action='store_true',
        help='Validate AWS credentials before uploading'
    )
    
    args = parser.parse_args()
    
    # Validate AWS credentials if requested
    if args.validate_aws:
        if not validate_aws_credentials():
            print("ERROR: AWS credentials not configured or invalid")
            print("Please configure AWS credentials using 'aws configure' or environment variables")
            sys.exit(1)
        print("AWS credentials validated successfully")
    
    # Create uploader and run upload
    uploader = S3Uploader(args.environment, args.verbose)
    result = uploader.upload(args.max_workers)
    
    # Print results
    if result['success']:
        print(f"\n✅ Upload completed successfully to {result['bucket']}")
        print(f"🌍 Environment: {result['environment']}")
        
        results = result['results']
        print(f"📊 Upload statistics:")
        print(f"   Files: {results['success_count']}/{results['total_files']}")
        print(f"   Size: {results['total_size_mb']} MB")
        print(f"   Success rate: {results['success_rate']:.1f}%")
        
        sys.exit(0)
    else:
        print(f"\n❌ Upload failed to {result['bucket']}")
        print(f"Environment: {result['environment']}")
        print(f"Error: {result['error']}")
        
        if 'results' in result:
            results = result['results']
            print(f"Partial results: {results['success_count']}/{results['total_files']} files uploaded")
        
        sys.exit(1)


if __name__ == '__main__':
    main()