#!/bin/bash
#
# Unified destroy script for Healthmate Frontend.
#
# This script handles both S3 bucket cleanup and CDK infrastructure destruction
# in a safe and comprehensive manner.
#

set -e  # Exit on any error

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"
CDK_DIR="$SCRIPT_DIR/cdk"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 <environment> [options]

Destroy Healthmate Frontend infrastructure and clean up resources

ENVIRONMENTS:
    dev     Destroy development environment
    stage   Destroy staging environment  
    prod    Destroy production environment

OPTIONS:
    --skip-bucket-cleanup    Skip S3 bucket content cleanup
    --force                  Skip confirmation prompts
    --verbose, -v           Enable verbose logging
    --help, -h              Show this help message

EXAMPLES:
    $0 dev                    # Destroy dev environment (with confirmation)
    $0 prod --force           # Destroy prod without confirmation
    $0 stage --skip-bucket-cleanup  # Destroy without cleaning S3 bucket
    
PREREQUISITES:
    - Python 3.12+ with virtual environment support
    - AWS credentials configured (aws configure or environment variables)
    - AWS CDK CLI installed (npm install -g aws-cdk)
    
DESTRUCTION STEPS:
    1. Check prerequisites and confirm destruction
    2. Clean up S3 bucket contents (if not skipped)
    3. Destroy CDK infrastructure
    4. Verify cleanup completion
EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install Python 3."
        exit 1
    fi
    
    # Check AWS CDK CLI
    if ! command -v cdk &> /dev/null; then
        print_error "AWS CDK CLI is not installed. Please install with: npm install -g aws-cdk"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Please run 'aws configure' or set environment variables."
        exit 1
    fi
    
    # Check if CDK directory exists
    if [ ! -d "$CDK_DIR" ]; then
        print_error "CDK directory not found: $CDK_DIR"
        exit 1
    fi
    
    print_success "Prerequisites check completed"
}

# Function to setup Python virtual environment for CDK
setup_cdk_venv() {
    if [ ! -d "$CDK_DIR/.venv" ]; then
        print_info "Setting up Python virtual environment for CDK..."
        cd "$CDK_DIR"
        python3 -m venv .venv
        source .venv/bin/activate
        pip install -r requirements.txt
        cd "$SCRIPT_DIR"
        print_success "CDK virtual environment created and dependencies installed"
    fi
}

# Function to activate Python virtual environment for CDK
activate_cdk_venv() {
    cd "$CDK_DIR"
    source .venv/bin/activate
    cd "$SCRIPT_DIR"
}

# Function to confirm destruction
confirm_destruction() {
    local environment="$1"
    local force="$2"
    
    if [ "$force" = true ]; then
        print_warning "Force mode enabled - skipping confirmation"
        return 0
    fi
    
    echo ""
    print_warning "⚠️  DESTRUCTIVE OPERATION WARNING ⚠️"
    print_warning "This will permanently delete the following resources for environment: $environment"
    print_warning "  • S3 bucket and all contents"
    print_warning "  • CloudFront distribution"
    print_warning "  • All associated AWS resources"
    echo ""
    
    read -p "Are you sure you want to proceed? Type 'yes' to confirm: " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        print_info "Destruction cancelled by user"
        exit 0
    fi
    
    print_info "Destruction confirmed. Proceeding..."
}

# Function to clean up S3 bucket contents
cleanup_s3_bucket() {
    local environment="$1"
    local skip_cleanup="$2"
    
    if [ "$skip_cleanup" = true ]; then
        print_warning "Skipping S3 bucket cleanup"
        return 0
    fi
    
    print_info "Cleaning up S3 bucket contents for $environment environment..."
    
    # Get bucket name from CloudFormation stack
    local stack_name="Healthmate-FrontendStack-$environment"
    local bucket_name
    
    bucket_name=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$bucket_name" ] || [ "$bucket_name" = "None" ]; then
        print_warning "Could not find S3 bucket name from CloudFormation stack. Skipping bucket cleanup."
        return 0
    fi
    
    print_info "Found S3 bucket: $bucket_name"
    
    # Check if bucket exists
    if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
        print_info "Emptying S3 bucket: $bucket_name"
        aws s3 rm "s3://$bucket_name" --recursive
        print_success "S3 bucket contents cleaned up successfully"
    else
        print_warning "S3 bucket does not exist or is not accessible: $bucket_name"
    fi
}

# Function to destroy CDK infrastructure
destroy_cdk() {
    local environment="$1"
    
    print_info "Destroying CDK infrastructure for $environment environment..."
    
    # Setup and activate CDK virtual environment
    setup_cdk_venv
    activate_cdk_venv
    
    # Set environment variable for CDK
    export HEALTHMATE_ENV="$environment"
    
    # Change to CDK directory
    cd "$CDK_DIR"
    
    # Check if stack exists
    local stack_name="Healthmate-FrontendStack-$environment"
    if ! aws cloudformation describe-stacks --stack-name "$stack_name" &>/dev/null; then
        print_warning "CDK stack '$stack_name' does not exist. Nothing to destroy."
        cd "$SCRIPT_DIR"
        return 0
    fi
    
    # Destroy CDK stack
    print_info "Destroying CDK stack: $stack_name"
    cdk destroy "$stack_name" \
        --force \
        --context environment="$environment"
    
    local exit_code=$?
    cd "$SCRIPT_DIR"
    
    if [ $exit_code -eq 0 ]; then
        print_success "CDK infrastructure destroyed successfully"
    else
        print_error "CDK destruction failed with exit code $exit_code"
        exit $exit_code
    fi
}

# Function to verify cleanup
verify_cleanup() {
    local environment="$1"
    
    print_info "Verifying cleanup completion..."
    
    local stack_name="Healthmate-FrontendStack-$environment"
    
    # Check if stack still exists
    if aws cloudformation describe-stacks --stack-name "$stack_name" &>/dev/null; then
        print_warning "CloudFormation stack still exists: $stack_name"
        print_info "This may be normal if deletion is still in progress."
    else
        print_success "CloudFormation stack successfully deleted: $stack_name"
    fi
}

# Main destruction function
destroy() {
    local environment="$1"
    local skip_bucket_cleanup=false
    local force=false
    local verbose=false
    
    # Parse options
    shift  # Remove environment from arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-bucket-cleanup)
                skip_bucket_cleanup=true
                shift
                ;;
            --force)
                force=true
                shift
                ;;
            --verbose|-v)
                verbose=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    print_info "Starting destruction of $environment environment..."
    print_info "Options: skip-bucket-cleanup=$skip_bucket_cleanup, force=$force, verbose=$verbose"
    
    # Check prerequisites
    check_prerequisites
    
    # Confirm destruction (unless forced)
    confirm_destruction "$environment" "$force"
    
    # Step 1: Clean up S3 bucket contents (unless skipped)
    cleanup_s3_bucket "$environment" "$skip_bucket_cleanup"
    
    # Step 2: Destroy CDK infrastructure
    destroy_cdk "$environment"
    
    # Step 3: Verify cleanup
    verify_cleanup "$environment"
    
    echo ""
    print_success "🗑️ Destruction completed successfully!"
    print_info "📋 Destruction Summary:"
    print_info "   Environment: $environment"
    print_info "   S3 Bucket Cleanup: $([ "$skip_bucket_cleanup" = true ] && echo "Skipped" || echo "Completed")"
    print_info "   CDK Infrastructure: Destroyed"
    print_info ""
    print_warning "Note: It may take a few minutes for all AWS resources to be fully deleted."
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    print_error "No environment specified"
    show_usage
    exit 1
fi

case "$1" in
    -h|--help)
        show_usage
        exit 0
        ;;
    dev|stage|prod)
        destroy "$@"
        ;;
    *)
        print_error "Invalid environment: $1"
        print_info "Valid environments: dev, stage, prod"
        show_usage
        exit 1
        ;;
esac
