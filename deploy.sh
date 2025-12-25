#!/bin/bash
#
# Deployment wrapper script for Healthmate Frontend.
#
# This script provides a convenient interface for deploying the frontend
# to different environments using the Python deployment scripts.
#

set -e  # Exit on any error

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

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

Deploy Healthmate Frontend to AWS S3 + CloudFront

ENVIRONMENTS:
    dev     Deploy to development environment
    stage   Deploy to staging environment  
    prod    Deploy to production environment

OPTIONS:
    --skip-build         Skip the frontend build step
    --verbose, -v       Enable verbose logging
    --help, -h          Show this help message

EXAMPLES:
    $0 dev                    # Deploy to dev environment
    $0 prod --verbose         # Deploy to prod with verbose output
    $0 stage --skip-build     # Deploy to stage without building
    
PREREQUISITES:
    - Node.js and npm installed
    - AWS credentials configured (aws configure or environment variables)
    - CDK infrastructure deployed for the target environment
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
    
    # Check if scripts directory exists
    if [ ! -d "$SCRIPTS_DIR" ]; then
        print_error "Scripts directory not found: $SCRIPTS_DIR"
        exit 1
    fi
    
    # Check if virtual environment exists
    if [ ! -d "$SCRIPTS_DIR/.venv" ]; then
        print_warning "Python virtual environment not found. Creating..."
        cd "$SCRIPTS_DIR"
        python3 -m venv .venv
        source .venv/bin/activate
        pip install -r requirements.txt
        cd "$SCRIPT_DIR"
        print_success "Virtual environment created and dependencies installed"
    fi
    
    print_success "Prerequisites check completed"
}

# Function to activate Python virtual environment
activate_venv() {
    cd "$SCRIPTS_DIR"
    source .venv/bin/activate
    cd "$SCRIPT_DIR"
}

# Main deployment function
deploy() {
    local environment="$1"
    shift  # Remove environment from arguments
    
    print_info "Starting deployment to $environment environment..."
    
    # Check prerequisites
    check_prerequisites
    
    # Activate virtual environment
    activate_venv
    
    # Run deployment
    cd "$SCRIPTS_DIR"
    python deploy.py "$environment" "$@"
    local exit_code=$?
    cd "$SCRIPT_DIR"
    
    if [ $exit_code -eq 0 ]; then
        echo ""
        print_success "Deployment completed successfully!"
        print_info "Check the output above for the CloudFront distribution URL"
    else
        print_error "Deployment failed with exit code $exit_code"
        exit $exit_code
    fi
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