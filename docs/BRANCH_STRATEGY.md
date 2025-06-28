# Git Branch Strategy and Deployment Workflow

## 🌿 **Branch Structure**

```
main (production)
  ↑
staging (pre-production)
  ↑
feature/branch-name (development)
```

### **Branch Purposes**

**🎯 `main`** - Production branch
- **Deploys to**: Production (mano.app)
- **Database**: Production Supabase (`zfroutbzdkhivnpiezho`)
- **Trigger**: Automatic deploy on push
- **Protection**: Requires PR from staging + approval

**🧪 `staging`** - Pre-production testing
- **Deploys to**: Staging (staging-mano.vercel.app)  
- **Database**: Staging Supabase (`yfkbevovqyjwanrubddq`)
- **Trigger**: Automatic deploy on push
- **Protection**: Requires PR + checks

**🔧 `feature/*`** - Development branches
- **Deploys to**: None (local testing only)
- **Database**: Local Supabase
- **Merges to**: `staging` via PR

## 🚀 **Complete Workflow**

### **1. Feature Development**
```bash
# Start from staging
git checkout staging
git pull origin staging

# Create feature branch
git checkout -b feature/awesome-new-feature

# Develop with local testing
./scripts/reset-with-test-data.sh
pnpm dev

# Test thoroughly
node test-complete-system.js
npm run lint
npm run build
```

### **2. Submit for Review**
```bash
# Push feature branch
git push origin feature/awesome-new-feature

# Create PR: feature/awesome-new-feature → staging
# - Automated checks run
# - Code review required
# - All checks must pass
```

### **3. Staging Deployment** 
```bash
# After PR approval and merge to staging:
# - Auto-deploys to staging environment
# - Applies migrations to staging database
# - Runs health checks
# - Available at staging-mano.vercel.app
```

### **4. Production Release**
```bash
# Create PR: staging → main
# - Additional production checks
# - Requires team approval
# - Deploys to production automatically
```

## 🛡️ **Safety Mechanisms**

### **Automated Checks (All PRs)**
- ✅ **ESLint + TypeScript**: Code quality
- ✅ **Security scanning**: No hardcoded secrets
- ✅ **Migration safety**: No dangerous operations
- ✅ **Build verification**: Ensure app compiles
- ✅ **Console.log detection**: Clean production code

### **Branch Protection Rules**

**Staging Branch:**
- ✅ Require PR before merging
- ✅ Require status checks to pass
- ✅ Dismiss stale reviews on new commits
- ✅ Require conversation resolution

**Main Branch:**
- ✅ All staging requirements +
- ✅ Require 1+ approvals
- ✅ Restrict pushes to staging branch only
- ✅ Include administrators in restrictions

## 🔧 **Environment Connections**

### **Vercel Project Setup**
```bash
# Connect staging branch to staging deployment
vercel --scope=your-team
vercel link
# Configure staging deployment with staging env vars

# Main branch automatically connects to production
```

### **Supabase Project Connections**
- **Staging branch** → Staging Supabase (`yfkbevovqyjwanrubddq`)
- **Main branch** → Production Supabase (`zfroutbzdkhivnpiezho`)
- **Local development** → Local Docker Supabase

### **Environment Variables by Branch**

**Staging:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://yfkbevovqyjwanrubddq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key
NODE_ENV=staging
```

**Production:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://zfroutbzdkhivnpiezho.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=production-anon-key
NODE_ENV=production
```

## 📋 **Developer Commands**

### **Daily Development**
```bash
# Fresh start with test data
./scripts/reset-with-test-data.sh

# Create safe migration
./scripts/safe-migration.sh add_feature "Description"

# Run full test suite
npm test  # (lint + typecheck + build)
```

### **Branch Management**
```bash
# Switch to staging for new feature
git checkout staging && git pull

# Create and push feature branch
git checkout -b feature/my-feature
git push -u origin feature/my-feature

# Keep feature branch updated
git checkout staging && git pull
git checkout feature/my-feature
git rebase staging
```

### **Environment Testing**
```bash
# Test staging deployment
curl https://staging-mano.vercel.app/api/health

# Test production deployment  
curl https://mano.app/api/health
```

## ⚡ **Quick Reference**

### **Branch Commands**
```bash
# Start new feature
git checkout staging && git pull
git checkout -b feature/my-feature

# Submit for review
git push -u origin feature/my-feature
# Create PR: feature/my-feature → staging

# Deploy to production
# Create PR: staging → main
```

### **Environment URLs**
- **Local**: `http://localhost:3000`
- **Staging**: `https://staging-mano.vercel.app`
- **Production**: `https://mano.app`

### **Database Projects**
- **Local**: Docker container
- **Staging**: `yfkbevovqyjwanrubddq`
- **Production**: `zfroutbzdkhivnpiezho`

This workflow ensures **zero production incidents** while maintaining **rapid development velocity**! 🎯