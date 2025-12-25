#!/usr/bin/env python3
"""
Integrated Deployment script for Healthmate Frontend.

This script handles the complete deployment process:
1. Frontend build (npm run build:environment)
2. S3 upload
3. CloudFront cache invalidation
4. Error handling and rollback
"""

import os
import sys
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Optional
import argparse
import logging

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import (
    EnvironmentSettings,
    DeploymentConfig,
    get_project_root,
    get_dist_directory,
    validate_aws_credentials
)
from upload import S3Uploader


class DeploymentError(Exception):
    """Custom exception for deployment errors."""
    pass


class HealthmateFrontendDeployer:
    """Integrated deployer for Healthmate Frontend."""
    
    def __init__(self, environment: str, verbose: bool = False):
        """
        Initialize the deployer.
        
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
        
        # Load environment settings
        try:
            self.settings = EnvironmentSettings.load(environment)
            self.logger.info(f"Loaded settings for environment: {environment}")
        except Exception as e:
            raise DeploymentError(f"Failed to load environment settings: {e}")
        
        # Initialize components
        self.uploader = S3Uploader(environment, verbose)
    
    def validate_prerequisites(self) -> None:
        """Validate deployment prerequisites."""
        self.logger.info("Validating deployment prerequisites...")
        
        # Check if npm is available
        try:
            result = subprocess.run(['npm', '--version'], capture_output=True, text=True)
            if result.returncode != 0:
                raise DeploymentError("npm is not available")
            self.logger.debug(f"npm version: {result.stdout.strip()}")
        except FileNotFoundError:
            raise DeploymentError("npm not found. Please install Node.js and npm.")
        
        # Check if package.json exists
        package_json = self.project_root / 'package.json'
        if not package_json.exists():
            raise DeploymentError(f"package.json not found in {self.project_root}")
        
        # Check if build script exists
        try:
            result = subprocess.run(
                ['npm', 'run', f'build:{self.environment}', '--dry-run'],
                cwd=self.project_root,
                capture_output=True,
                text=True
            )
            # Note: --dry-run might not be supported, so we just check if the script exists
        except Exception:
            pass  # We'll catch this during actual build
        
        # Validate AWS credentials
        if not validate_aws_credentials():
            raise DeploymentError("AWS credentials not configured or invalid")
        
        self.logger.info("Prerequisites validation completed")
    
    def run_frontend_build(self) -> Dict[str, any]:
        """
        Run the frontend build process using npm.
        
        Returns:
            Build result dictionary
        """
        self.logger.info(f"Building frontend for {self.environment} environment...")
        
        # Clean dist directory first
        if self.dist_dir.exists():
            import shutil
            shutil.rmtree(self.dist_dir)
            self.logger.info(f"Cleaned existing dist directory: {self.dist_dir}")
        
        # Prepare build command
        build_command = ['npm', 'run', f'build:{self.environment}']
        
        # Load environment variables from .env files
        env_vars = os.environ.copy()
        
        # Try to load environment-specific .env file
        env_files = [
            self.project_root / f'.env.{self.environment}',
            self.project_root / '.env.local',
            self.project_root / '.env'
        ]
        
        for env_file in env_files:
            if env_file.exists():
                self.logger.debug(f"Loading environment variables from {env_file}")
                try:
                    with open(env_file, 'r') as f:
                        for line in f:
                            line = line.strip()
                            if line and not line.startswith('#') and '=' in line:
                                key, value = line.split('=', 1)
                                env_vars[key.strip()] = value.strip()
                except Exception as e:
                    self.logger.warning(f"Failed to load {env_file}: {e}")
        
        # Set deployment-specific environment variables
        env_vars['HEALTHMATE_ENV'] = self.environment
        env_vars['NODE_ENV'] = 'production'
        
        try:
            start_time = time.time()
            
            result = subprocess.run(
                build_command,
                cwd=self.project_root,
                env=env_vars,
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes timeout
            )
            
            build_time = time.time() - start_time
            
            if result.returncode != 0:
                self.logger.error("Frontend build failed:")
                self.logger.error(f"stdout: {result.stdout}")
                self.logger.error(f"stderr: {result.stderr}")
                raise DeploymentError("Frontend build process failed")
            
            # Validate build output
            if not self.dist_dir.exists():
                raise DeploymentError(f"Build output directory not found: {self.dist_dir}")
            
            # Check for required files
            index_html = self.dist_dir / 'index.html'
            if not index_html.exists():
                raise DeploymentError("index.html not found in build output")
            
            # Collect build statistics
            total_files = 0
            total_size = 0
            
            for file_path in self.dist_dir.rglob('*'):
                if file_path.is_file():
                    total_files += 1
                    total_size += file_path.stat().st_size
            
            self.logger.info(f"Frontend build completed successfully in {build_time:.1f}s")
            self.logger.info(f"Build output: {total_files} files, {total_size / (1024*1024):.2f} MB")
            
            # Log build output in verbose mode
            if self.logger.isEnabledFor(logging.DEBUG):
                self.logger.debug("Build stdout:")
                self.logger.debug(result.stdout)
            
            return {
                'success': True,
                'build_time': build_time,
                'total_files': total_files,
                'total_size': total_size,
                'dist_directory': str(self.dist_dir)
            }
            
        except subprocess.TimeoutExpired:
            raise DeploymentError("Frontend build process timed out")
        except Exception as e:
            raise DeploymentError(f"Unexpected error during build: {e}")
    
    def deploy(self, skip_build: bool = False) -> Dict[str, any]:
        """
        Execute the complete deployment process.
        
        Args:
            skip_build: Skip the frontend build step
            
        Returns:
            Deployment results dictionary
        """
        deployment_start = time.time()
        results = {
            'success': False,
            'environment': self.environment,
            'steps': {},
            'total_time': 0
        }
        
        try:
            self.logger.info(f"Starting deployment to {self.environment} environment")
            
            # Step 1: Validate prerequisites
            self.logger.info("Step 1: Validating prerequisites...")
            step_start = time.time()
            self.validate_prerequisites()
            results['steps']['prerequisites'] = {
                'success': True,
                'time': time.time() - step_start
            }
            
            # Step 2: Frontend build
            if not skip_build:
                self.logger.info("Step 2: Building frontend...")
                step_start = time.time()
                build_result = self.run_frontend_build()
                results['steps']['build'] = {
                    'success': True,
                    'time': time.time() - step_start,
                    'details': build_result
                }
            else:
                self.logger.info("Step 2: Skipping frontend build")
                results['steps']['build'] = {'success': True, 'skipped': True}
            
            # Step 3: S3 upload
            self.logger.info("Step 3: Uploading to S3...")
            step_start = time.time()
            upload_result = self.uploader.upload()
            
            if not upload_result['success']:
                raise DeploymentError(f"S3 upload failed: {upload_result['error']}")
            
            results['steps']['upload'] = {
                'success': True,
                'time': time.time() - step_start,
                'details': upload_result
            }
            
            # Calculate total time
            results['total_time'] = time.time() - deployment_start
            results['success'] = True
            
            self.logger.info(f"🎉 Deployment completed successfully in {results['total_time']:.1f}s")
            self.logger.info("Note: CloudFront caching is disabled, so changes are immediately visible")
            
            return results
            
        except DeploymentError as e:
            results['total_time'] = time.time() - deployment_start
            results['error'] = str(e)
            self.logger.error(f"Deployment failed: {e}")
            return results
        except Exception as e:
            results['total_time'] = time.time() - deployment_start
            results['error'] = f"Unexpected error: {e}"
            self.logger.error(f"Unexpected error during deployment: {e}")
            return results
    
    def rollback(self) -> Dict[str, any]:
        """
        Perform rollback operations (placeholder for future implementation).
        
        Returns:
            Rollback results dictionary
        """
        self.logger.warning("Rollback functionality not yet implemented")
        return {
            'success': False,
            'error': 'Rollback functionality not yet implemented'
        }


def main():
    """Main entry point for the deployment script."""
    parser = argparse.ArgumentParser(description='Deploy Healthmate Frontend')
    parser.add_argument(
        'environment',
        choices=['dev', 'stage', 'prod'],
        help='Target environment for deployment'
    )
    parser.add_argument(
        '--skip-build',
        action='store_true',
        help='Skip the frontend build step'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Create deployer and run deployment
    deployer = HealthmateFrontendDeployer(args.environment, args.verbose)
    result = deployer.deploy(skip_build=args.skip_build)
    
    # Print results
    if result['success']:
        print(f"\n🎉 Deployment completed successfully!")
        print(f"🌍 Environment: {result['environment']}")
        print(f"⏱️  Total time: {result['total_time']:.1f}s")
        
        # Print step details
        for step_name, step_result in result['steps'].items():
            if step_result.get('skipped'):
                print(f"⏭️  {step_name.title()}: Skipped")
            elif step_result['success']:
                step_time = step_result.get('time', 0)
                print(f"✅ {step_name.title()}: {step_time:.1f}s")
            else:
                print(f"⚠️  {step_name.title()}: Failed - {step_result.get('error', 'Unknown error')}")
        
        # Print upload statistics if available
        if 'upload' in result['steps'] and 'details' in result['steps']['upload']:
            upload_details = result['steps']['upload']['details']
            if 'results' in upload_details:
                upload_results = upload_details['results']
                print(f"📊 Upload: {upload_results['success_count']} files, {upload_results['total_size_mb']} MB")
        
        sys.exit(0)
    else:
        print(f"\n❌ Deployment failed")
        print(f"Environment: {result['environment']}")
        print(f"Error: {result['error']}")
        print(f"Time elapsed: {result['total_time']:.1f}s")
        
        # Print step status
        for step_name, step_result in result['steps'].items():
            if step_result.get('skipped'):
                print(f"⏭️  {step_name.title()}: Skipped")
            elif step_result['success']:
                print(f"✅ {step_name.title()}: Completed")
            else:
                print(f"❌ {step_name.title()}: Failed")
        
        sys.exit(1)


if __name__ == '__main__':
    main()