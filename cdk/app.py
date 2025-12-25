#!/usr/bin/env python3
"""
Healthmate Frontend Hosting CDK App

This CDK application creates the infrastructure for hosting the Healthmate Frontend
on Amazon S3 with CloudFront distribution.
"""

import os
import sys
from pathlib import Path

# Add the cdk directory to Python path for imports
sys.path.append(str(Path(__file__).parent))

import aws_cdk as cdk
from healthmate_frontend_hosting_stack import HealthmateFrontendHostingStack, HostingStackProps


def main():
    """Main entry point for the CDK application."""
    app = cdk.App()
    
    # Get environment from context or environment variable
    environment = app.node.try_get_context("environment") or os.environ.get("HEALTHMATE_ENV", "dev")
    
    # Validate environment
    valid_environments = ["dev", "stage", "prod"]
    if environment not in valid_environments:
        raise ValueError(f"Invalid environment: {environment}. Must be one of {valid_environments}")
    
    # Create stack properties
    props = HostingStackProps(
        environment=environment
    )
    
    # Create the hosting stack
    stack = HealthmateFrontendHostingStack(
        app,
        f"HealthmateFrontendHosting-{environment.title()}",
        props,
        env=cdk.Environment(
            account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
            region=os.environ.get("CDK_DEFAULT_REGION", "us-west-2")
        ),
        description=f"Healthmate Frontend S3 + CloudFront hosting infrastructure for {environment} environment"
    )
    
    # Add tags to all resources
    cdk.Tags.of(stack).add("Environment", environment)
    cdk.Tags.of(stack).add("Service", "healthmate-frontend")
    cdk.Tags.of(stack).add("CostCenter", "healthmate")
    cdk.Tags.of(stack).add("ManagedBy", "CDK")
    
    app.synth()


if __name__ == "__main__":
    main()