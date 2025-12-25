# Healthmate Frontend Hosting CDK

This directory contains the AWS CDK (Cloud Development Kit) infrastructure code for hosting the Healthmate Frontend application using Amazon S3 and CloudFront.

## Architecture

- **S3 Bucket**: Stores static assets (HTML, CSS, JavaScript files)
- **CloudFront Distribution**: Global CDN for fast content delivery
- **Origin Access Identity**: Secure access from CloudFront to S3
- **Error Pages**: SPA routing support (404/403 → index.html)

## Prerequisites

1. **Python 3.8+** installed
2. **AWS CLI** configured with appropriate credentials
3. **AWS CDK** installed globally: `npm install -g aws-cdk`
4. **Virtual environment** set up

## Setup

### 1. Create and activate virtual environment

```bash
cd cdk
python3 -m venv .venv
source .venv/bin/activate  # On macOS/Linux
# .venv\Scripts\activate.bat  # On Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Bootstrap CDK (first time only)

```bash
cdk bootstrap
```

## Deployment

### Deploy to specific environment

```bash
# Deploy to development environment
cdk deploy --context environment=dev

# Deploy to staging environment
cdk deploy --context environment=stage

# Deploy to production environment
cdk deploy --context environment=prod
```

### Alternative: Set environment variable

```bash
export HEALTHMATE_ENV=dev
cdk deploy
```

## Stack Outputs

After deployment, the stack provides these outputs:

- **BucketName**: S3 bucket name for uploading static assets
- **DistributionId**: CloudFront distribution ID for cache invalidation
- **DistributionDomainName**: CloudFront domain name
- **WebsiteUrl**: Complete HTTPS URL for accessing the application

## Environment-Specific Resources

Each environment (dev/stage/prod) creates separate resources:

- S3 Bucket: `healthmate-frontend-{env}-{random-suffix}`
- CloudFormation Stack: `HealthmateFrontendHosting-{Env}`
- CloudFront Distribution: Tagged with environment

## Development Commands

```bash
# Synthesize CloudFormation template
cdk synth

# Show differences between deployed stack and current code
cdk diff

# List all stacks
cdk list

# Destroy stack (careful!)
cdk destroy
```

## Testing

```bash
# Run unit tests
pytest tests/

# Run tests with coverage
pytest --cov=. tests/

# Type checking
mypy .

# Code formatting
black .

# Linting
flake8 .
```

## Security Features

- **HTTPS Only**: CloudFront redirects HTTP to HTTPS
- **Origin Access Identity**: S3 bucket only accessible via CloudFront
- **Server-Side Encryption**: S3 objects encrypted at rest
- **Versioning**: S3 bucket versioning enabled for rollback capability
- **CORS Configuration**: Appropriate CORS headers for API calls

## Cost Optimization

- **Price Class 100**: CloudFront uses US/Europe edge locations only
- **Compression**: Automatic compression enabled
- **Caching**: Optimized cache policies for static assets
- **Lifecycle Policies**: Automatic cleanup of old versions

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure AWS credentials are configured
2. **Stack Already Exists**: Use `cdk diff` to see changes, then `cdk deploy`
3. **Bucket Name Conflict**: Bucket names are globally unique, random suffix prevents conflicts

### Useful Commands

```bash
# Check AWS credentials
aws sts get-caller-identity

# View CloudFormation events
aws cloudformation describe-stack-events --stack-name HealthmateFrontendHosting-Dev

# List S3 buckets
aws s3 ls

# Check CloudFront distributions
aws cloudfront list-distributions
```

## Integration with Frontend

After deployment, update the frontend environment variables:

```bash
# .env.{environment}
VITE_S3_BUCKET_NAME=healthmate-frontend-dev-abc12345
VITE_CLOUDFRONT_DISTRIBUTION_ID=E1234567890ABC
VITE_CLOUDFRONT_DOMAIN=d1234567890abc.cloudfront.net
```

## Next Steps

1. Deploy the CDK stack
2. Configure deployment scripts to upload built assets
3. Set up CI/CD pipeline for automated deployments
4. Configure monitoring and alerting