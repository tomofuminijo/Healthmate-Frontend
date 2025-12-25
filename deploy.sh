#!/bin/bash
#
# Unified deployment script for Healthmate Frontend.
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

Deploy Healthmate Frontend infrastructure and application to AWS

ENVIRONMENTS:
    dev     Deploy to development environment
    stage   Deploy to staging environment  
    prod    Deploy to production environment

OPTIONS:
    --skip-cdk           Skip CDK infrastructure deployment
    --skip-build         Skip the frontend build step
    --skip-upload        Skip the S3 upload step
    --verbose, -v        Enable verbose logging
    --help, -h           Show this help message

EXAMPLES:
    $0 dev                    # Full deployment (CDK + build + upload)
    $0 prod --verbose         # Deploy to prod with verbose output
    $0 stage --skip-cdk       # Deploy app only (skip infrastructure)
    $0 dev --skip-build       # Deploy without rebuilding frontend
    
PREREQUISITES:
    - Node.js and npm installed
    - Python 3.12+ with virtual environment support
    - AWS credentials configured (aws configure or environment variables)
    - AWS CDK CLI installed (npm install -g aws-cdk)
EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js and npm."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
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
    
    # Check if directories exist
    if [ ! -d "$SCRIPTS_DIR" ]; then
        print_error "Scripts directory not found: $SCRIPTS_DIR"
        exit 1
    fi
    
    if [ ! -d "$CDK_DIR" ]; then
        print_error "CDK directory not found: $CDK_DIR"
        exit 1
    fi
    
    print_success "Prerequisites check completed"
}

# Function to setup Python virtual environment for scripts
setup_scripts_venv() {
    if [ ! -d "$SCRIPTS_DIR/.venv" ]; then
        print_info "Setting up Python virtual environment for scripts..."
        cd "$SCRIPTS_DIR"
        python3 -m venv .venv
        source .venv/bin/activate
        pip install -r requirements.txt
        cd "$SCRIPT_DIR"
        print_success "Scripts virtual environment created and dependencies installed"
    fi
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

# Function to activate Python virtual environment for scripts
activate_scripts_venv() {
    cd "$SCRIPTS_DIR"
    source .venv/bin/activate
    cd "$SCRIPT_DIR"
}

# Function to activate Python virtual environment for CDK
activate_cdk_venv() {
    cd "$CDK_DIR"
    source .venv/bin/activate
    cd "$SCRIPT_DIR"
}

# Function to deploy CDK infrastructure
deploy_cdk() {
    local environment="$1"
    
    print_info "Deploying CDK infrastructure for $environment environment..."
    
    # Setup and activate CDK virtual environment
    setup_cdk_venv
    activate_cdk_venv
    
    # Set environment variables for CDK (inherit from parent process if available)
    export HEALTHMATE_ENV="$environment"
    if [[ -n "$AWS_REGION" ]]; then
        print_info "Using AWS region from environment: $AWS_REGION"
    fi
    
    # Change to CDK directory
    cd "$CDK_DIR"
    
    # Bootstrap CDK if needed (only for first deployment)
    print_info "Checking CDK bootstrap status..."
    if ! cdk list &> /dev/null; then
        print_info "Bootstrapping CDK..."
        cdk bootstrap
    fi
    
    # Deploy CDK stack
    print_info "Deploying CDK stack: Healthmate-FrontendStack-$environment"
    cdk deploy "Healthmate-FrontendStack-$environment" \
        --require-approval never \
        --context environment="$environment"
    
    local exit_code=$?
    cd "$SCRIPT_DIR"
    
    if [ $exit_code -eq 0 ]; then
        print_success "CDK infrastructure deployed successfully"
        # CloudFormationの整合性確保のため少し待機
        print_info "Waiting for CloudFormation consistency..."
        sleep 10
    else
        print_error "CDK deployment failed with exit code $exit_code"
        exit $exit_code
    fi
}

# Function to generate environment file
generate_env_file() {
    local environment="$1"
    
    print_info "Generating .env.$environment file from CloudFormation..."
    
    # Setup and activate scripts virtual environment
    setup_scripts_venv
    activate_scripts_venv
    
    # Inherit AWS_REGION from parent process if available
    if [[ -n "$AWS_REGION" ]]; then
        print_info "Using AWS region from environment: $AWS_REGION"
        export AWS_REGION="$AWS_REGION"
    fi
    
    # Run environment file generator
    cd "$SCRIPTS_DIR"
    python generate_env.py "$environment"
    local exit_code=$?
    cd "$SCRIPT_DIR"
    
    if [ $exit_code -eq 0 ]; then
        print_success "Environment file .env.$environment generated successfully"
    else
        print_error "Failed to generate environment file"
        exit $exit_code
    fi
}

# Function to deploy frontend application
deploy_frontend() {
    local environment="$1"
    shift  # Remove environment from arguments
    
    print_info "Deploying frontend application to $environment environment..."
    
    # Setup and activate scripts virtual environment
    setup_scripts_venv
    activate_scripts_venv
    
    # Inherit AWS_REGION from parent process if available
    if [[ -n "$AWS_REGION" ]]; then
        export AWS_REGION="$AWS_REGION"
    fi
    
    # Run deployment
    cd "$SCRIPTS_DIR"
    python deploy.py "$environment" "$@"
    local exit_code=$?
    cd "$SCRIPT_DIR"
    
    if [ $exit_code -eq 0 ]; then
        print_success "Frontend application deployed successfully"
    else
        print_error "Frontend deployment failed with exit code $exit_code"
        exit $exit_code
    fi
}

# Main deployment function
deploy() {
    local environment="$1"
    local skip_cdk=false
    local skip_build=false
    local skip_upload=false
    local verbose=false
    
    # Parse options
    shift  # Remove environment from arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-cdk)
                skip_cdk=true
                shift
                ;;
            --skip-build)
                skip_build=true
                shift
                ;;
            --skip-upload)
                skip_upload=true
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
    
    print_info "Starting deployment to $environment environment..."
    print_info "Options: skip-cdk=$skip_cdk, skip-build=$skip_build, skip-upload=$skip_upload, verbose=$verbose"
    
    # Check prerequisites
    check_prerequisites
    
    # Step 1: Deploy CDK infrastructure (unless skipped)
    if [ "$skip_cdk" = false ]; then
        deploy_cdk "$environment"
    else
        print_warning "Skipping CDK infrastructure deployment"
    fi
    
    # Step 2: Generate environment file from CloudFormation
    generate_env_file "$environment"
    
    # Step 3: Deploy frontend application
    local deploy_args=""
    if [ "$skip_build" = true ]; then
        deploy_args="$deploy_args --skip-build"
    fi
    if [ "$skip_upload" = true ]; then
        deploy_args="$deploy_args --skip-upload"
    fi
    if [ "$verbose" = true ]; then
        deploy_args="$deploy_args --verbose"
    fi
    
    deploy_frontend "$environment" $deploy_args
    
    echo ""
    print_success "🎉 Deployment completed successfully!"
    print_info "📋 Deployment Summary:"
    print_info "   Environment: $environment"
    print_info "   CDK Infrastructure: $([ "$skip_cdk" = true ] && echo "Skipped" || echo "Deployed")"
    print_info "   Frontend Build: $([ "$skip_build" = true ] && echo "Skipped" || echo "Completed")"
    print_info "   S3 Upload: $([ "$skip_upload" = true ] && echo "Skipped" || echo "Completed")"
    print_info ""
    print_info "🌐 Check the output above for the CloudFront distribution URL"
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
        deploy "$@"
        ;;
    *)
        print_error "Invalid environment: $1"
        print_info "Valid environments: dev, stage, prod"
        show_usage
        exit 1
        ;;
esac