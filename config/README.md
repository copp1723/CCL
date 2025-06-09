# Configuration

## Environment Files

All environment configurations are located in `./environments/`:

- `.env.example` - Template with all required variables
- `.env.development` - Development environment settings
- `.env.staging` - Staging environment settings
- `.env.production` - Production environment settings

## Setup

Copy the appropriate environment file to the root as `.env`:

```bash
# For development
cp config/environments/.env.example .env

# For staging
cp config/environments/.env.staging .env

# For production
cp config/environments/.env.production .env
```

## Required Variables

See `.env.example` for complete list of required environment variables.
