# Bulletproof Deployment Guide: Feature → Staging → Production

This guide ensures safe, predictable deployments without compromising production data or stability.

## Prerequisites

### 1. Environment Setup
- [ ] Create a staging Supabase project (separate from production)
- [ ] Configure Netlify for branch deployments
- [ ] Set up GitHub repository secrets (see below)

### 2. Required GitHub Secrets

#### Staging Environment
- `STAGING_SUPABASE_URL`: Your staging Supabase URL
- `STAGING_SUPABASE_ANON_KEY`: Staging anonymous key
- `STAGING_SUPABASE_PROJECT_ID`: Staging project reference ID
- `STAGING_NETLIFY_URL`: Your staging Netlify URL

#### Production Environment
- `PRODUCTION_SUPABASE_PROJECT_ID`: Production project reference ID (zfroutbzdkhivnpiezho)
- `PRODUCTION_URL`: Your production URL
- `SUPABASE_ACCESS_TOKEN`: Your Supabase access token (for both environments)

## Deployment Workflow

### Phase 1: Feature Development

1. **Create Feature Branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Develop Your Feature**
   - Write code
   - Test locally with `pnpm run dev`
   - Use local Supabase instance: `supabase start`

3. **Before Creating PR**
   ```bash
   # Run quality checks locally
   pnpm run lint
   pnpm exec tsc --noEmit
   pnpm run build
   ```

### Phase 2: Pull Request to Staging

1. **Create Pull Request**
   - Target branch: `staging`
   - PR will trigger automated checks:
     - Code linting
     - TypeScript validation
     - Build verification
     - Migration validation

2. **Review Process**
   - Code review by team
   - All CI checks must pass
   - Manual testing plan documented

3. **Merge to Staging**
   ```bash
   # After approval
   git checkout staging
   git pull origin staging
   git merge --no-ff feature/your-feature-name
   git push origin staging
   ```

4. **Automatic Staging Deployment**
   - Netlify deploys frontend automatically
   - GitHub Actions deploys Supabase functions/migrations
   - Verify at staging URL

### Phase 3: Staging Testing

1. **Comprehensive Testing**
   - [ ] Feature functionality works as expected
   - [ ] No regression in existing features
   - [ ] Performance is acceptable
   - [ ] Mobile responsiveness verified
   - [ ] Edge cases handled

2. **Database Migration Testing**
   - [ ] Migrations run successfully
   - [ ] No data corruption
   - [ ] Rollback plan tested (if applicable)

### Phase 4: Production Deployment

1. **Create Production PR**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b release/staging-to-production
   git merge --no-ff staging
   ```

2. **Production Checklist**
   - [ ] All staging tests passed
   - [ ] Database backup created
   - [ ] Team notified of deployment window
   - [ ] Rollback plan documented

3. **Merge to Main**
   - Create PR from `release/staging-to-production` to `main`
   - Require approval from senior team member
   - Merge with "Create a merge commit" option

4. **Deploy to Production**
   - Go to Actions → "Deploy to Production"
   - Click "Run workflow"
   - Type `deploy-production` to confirm
   - Monitor deployment progress

5. **Post-Deployment Verification**
   - [ ] Production health check passes
   - [ ] Key features tested
   - [ ] Monitor error logs for 30 minutes
   - [ ] Check performance metrics

## Handling Supabase Migrations

### Creating Migrations
```bash
# Create a new migration
supabase migration new your_migration_name

# Edit the migration file in supabase/migrations/
# Test locally
supabase db reset
```

### Migration Best Practices
1. **Always test migrations on staging first**
2. **Include rollback statements when possible**
3. **Avoid breaking changes** - use multi-step migrations
4. **Document migration purpose** in comments

### Example Safe Migration Pattern
```sql
-- Migration: Add new column with default
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS feature_flag BOOLEAN DEFAULT false;

-- Rollback plan (document but don't include in migration)
-- ALTER TABLE users DROP COLUMN IF EXISTS feature_flag;
```

## Emergency Procedures

### Rollback Production

1. **Frontend Rollback (Netlify)**
   - Go to Netlify dashboard
   - Select production site
   - Go to "Deploys" → Find last working deploy
   - Click "Publish deploy"

2. **Supabase Function Rollback**
   ```bash
   # Checkout previous release
   git checkout <previous-release-tag>
   
   # Re-deploy functions
   supabase link --project-ref <production-id>
   supabase functions deploy <function-name>
   ```

3. **Database Rollback**
   - Use documented rollback SQL
   - Or restore from backup (last resort)

### Hotfix Process

For critical production issues:

1. **Create hotfix branch from main**
   ```bash
   git checkout main
   git checkout -b hotfix/critical-issue
   ```

2. **Fix and test locally**

3. **Deploy directly to staging for quick verification**

4. **Fast-track to production**
   - Create PR to main
   - Get emergency approval
   - Deploy immediately

## Security Considerations

1. **Never commit secrets**
   - Use environment variables
   - Check `.gitignore` includes `.env*`

2. **Review database access**
   - Ensure RLS policies are in place
   - Audit function permissions

3. **Monitor after deployment**
   - Check for unusual API usage
   - Monitor error rates

## Troubleshooting

### Common Issues

1. **Build fails on Netlify**
   - Check environment variables
   - Verify Node version matches local
   - Check for missing dependencies

2. **Supabase function won't deploy**
   - Verify access token is valid
   - Check function has index.ts
   - Ensure no syntax errors

3. **Migration fails**
   - Check for conflicts with existing schema
   - Verify migration order
   - Test rollback procedure

### Getting Help

- Check deployment logs in GitHub Actions
- Review Netlify build logs
- Check Supabase dashboard for function logs
- Contact team lead for production issues

## Maintenance

### Weekly Tasks
- [ ] Review and merge dependabot PRs to staging
- [ ] Check for security advisories
- [ ] Clean up old feature branches

### Monthly Tasks
- [ ] Test disaster recovery procedure
- [ ] Review and update this guide
- [ ] Audit access permissions

Remember: **When in doubt, don't deploy to production.** It's always better to delay a deployment than to break production.