# Git Branch Strategy & Deployment Workflow

This document outlines our Git workflow and deployment strategy for Mano.

## Branch Structure

```
main (production)
  ↑
staging (pre-production)
  ↑
feature/branch-name (development)
```

### Branches

1. **`main`** - Production branch
   - Protected branch with required reviews
   - Automatically deploys to production on push
   - Only accepts PRs from `staging`

2. **`staging`** - Pre-production testing
   - Protected branch
   - Automatically deploys to staging environment
   - Accepts PRs from feature branches

3. **`feature/*`** - Development branches
   - Created from `staging`
   - Where all development happens
   - Merged to `staging` via PR

## Development Workflow

### 1. Starting New Work
```bash
git checkout staging
git pull origin staging
git checkout -b feature/your-feature-name
```

### 2. During Development
- Commit frequently with clear messages
- Run tests locally before pushing
- Keep branch up to date with staging

```bash
git fetch origin
git rebase origin/staging
```

### 3. Creating a Pull Request
1. Push your feature branch
2. Create PR targeting `staging` branch
3. Ensure all checks pass
4. Request review

### 4. After Staging Review
Once tested in staging:
1. Create PR from `staging` to `main`
2. Require approval from team lead
3. Merge to deploy to production

## Deployment Pipeline

### Staging Deployment
- **Trigger**: Push to `staging` branch
- **Environment**: staging-mano.vercel.app
- **Database**: Staging Supabase project
- **Process**:
  1. Run tests and linting
  2. Check migration safety
  3. Apply database migrations
  4. Deploy to Vercel staging
  5. Run health checks

### Production Deployment
- **Trigger**: Push to `main` or manual workflow
- **Environment**: mano.app
- **Database**: Production Supabase project
- **Process**:
  1. Validate deployment confirmation
  2. Run comprehensive tests
  3. Verify staging is healthy
  4. Apply migrations with caution
  5. Deploy to Vercel production
  6. Extended health checks
  7. Post-deployment monitoring

## Pull Request Checks

All PRs run automated checks:
- **Code Quality**: ESLint, TypeScript, console.log detection
- **Security**: npm audit, hardcoded secrets scan
- **Migration Safety**: Dangerous operation detection
- **Build Test**: Ensure project builds successfully

## Database Migrations

### Creating Safe Migrations
```bash
npm run migration:create -- descriptive_name
```

### Migration Guidelines
1. Always backward compatible
2. Include rollback documentation
3. Test in staging first
4. No destructive operations without approval

### Rollback Procedure
```bash
# In case of issues
npm run migration:rollback
```

## Emergency Procedures

### Hotfix Process
1. Create hotfix branch from `main`
2. Apply minimal fix
3. Test locally
4. PR directly to `main` (requires 2 approvals)
5. Cherry-pick back to `staging`

### Rollback Production
```bash
# Revert Vercel deployment
vercel rollback

# If database rollback needed
npm run migration:emergency-rollback
```

## Environment Configuration

### Required GitHub Secrets
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `SUPABASE_ACCESS_TOKEN`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `PRODUCTION_SUPABASE_URL`
- `PRODUCTION_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `STAGING_URL`

### Local Setup
1. Copy `.env.staging.example` to `.env.staging`
2. Copy `.env.production.example` to `.env.production`
3. Fill in the values
4. Never commit `.env` files

## Best Practices

1. **Never force push** to protected branches
2. **Always test migrations** in staging first
3. **Monitor deployments** for at least 30 minutes
4. **Keep PRs focused** - one feature per PR
5. **Write clear commit messages** following conventional commits

## Monitoring

- Staging: Check health at `/api/health`
- Production: Monitor at production URL `/api/health`
- Set up alerts for deployment failures
- Review logs after each deployment