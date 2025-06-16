# Onboarding Test System

## 🎯 Overview

The Onboarding Test System provides development testing tools to easily test the onboarding flow without needing to create new accounts or use Google OAuth during development.

## 🚀 Features

- **🎯 Test user login**: Simple email/password for development testing
- **🎯 Reset button**: Clear all user data and restart onboarding
- **🎯 Development mode indicator**: Clear visual indication when in test mode
- **🎯 Quick test scenarios**: Preset test states for different onboarding stages

## 📁 System Architecture

### Core Components

```
lib/debug-user.ts              # Debug user management functions
├── checkDebugAccess()         # Check if user has debug access
├── createTestUser()           # Create test user account
└── ensureTestUserExists()     # Development setup helper

components/debug/
├── debug-panel.tsx            # Main debug UI panel
└── reset-button.tsx          # Reset functionality component

app/api/dev/reset-user/
└── route.ts                   # API endpoint for resetting user data
```

### Database Schema

```sql
-- Added to user_profiles table
ALTER TABLE user_profiles ADD COLUMN debug_mode BOOLEAN DEFAULT FALSE;
```

## 🛠️ Setup Instructions

### 1. Database Setup

The `debug_mode` column has been added to the `user_profiles` table via migration:

```bash
npx supabase migration up
```

### 2. Create Test User

1. **Start development server**: `npm run dev`
2. **Go to signup**: http://localhost:3000/auth/sign-up  
3. **Create test account**:
   - Email: `test@mano.dev`
   - Password: `testuser123`

### 3. Enable Debug Access

**Via Supabase Dashboard:**
1. Go to Table Editor → `user_profiles`
2. Find test user row (email: test@mano.dev)
3. Set `debug_mode` to `true`

**Via SQL:**
```sql
UPDATE user_profiles 
SET debug_mode = TRUE 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'test@mano.dev'
);
```

## 🔄 Using the Test System

### Debug Panel Access

Once a user has `debug_mode = true`:
1. **🐛 Button** appears in bottom-right corner
2. **Click to expand** debug panel
3. **Reset functionality** available immediately

### Reset Workflow

1. **Open debug panel** (🐛 button)
2. **Click "Reset Test Data"**
3. **Confirm deletion** of all user data
4. **Automatic redirect** to onboarding flow
5. **Fresh test environment** ready

### What Gets Reset

The reset operation clears:
- ✅ All conversation embeddings
- ✅ All conversation summary embeddings  
- ✅ All messages
- ✅ All people/contacts
- ✅ User profile (reset to onboarding state)
- ❌ Debug access (preserved)

## 🔒 Security & Access Control

### Debug Access Requirements

- **Database flag**: `debug_mode = true` in user profile
- **API verification**: Reset endpoint checks debug access
- **UI filtering**: Debug panel only shows for authorized users

### Safety Measures

- **Environment protection**: Only works in development
- **Confirmation flow**: Double-check before destructive operations
- **Audit logging**: All operations logged to console
- **Data isolation**: Only affects current user's data

## 🎮 Development Workflow

### Typical Testing Session

```bash
# 1. Start development
npm run dev

# 2. Sign in as test user
# Email: test@mano.dev
# Password: testuser123

# 3. Make onboarding changes
# 4. Reset via debug panel
# 5. Test new onboarding flow
# 6. Repeat as needed
```

### Testing Different Scenarios

**Fresh User Experience:**
- Reset completely
- Test first-time onboarding

**Partial Onboarding:**
- Reset, then manually set onboarding_step
- Test specific onboarding stages

**Returning User:**
- Complete onboarding once
- Reset and test returning user flow

## 🐛 Troubleshooting

### Debug Panel Not Appearing

**Check:**
- User signed in correctly
- `debug_mode = true` in database
- No JavaScript errors in console

**Fix:**
```sql
-- Verify debug access
SELECT email, debug_mode 
FROM auth.users 
JOIN user_profiles ON users.id = user_profiles.user_id 
WHERE email = 'test@mano.dev';
```

### Reset Not Working

**Common Issues:**
- User lacks debug access
- Database foreign key constraints
- Network/API errors

**Check logs:**
```bash
# Check server logs for reset errors
# Look for "Resetting user data for:" messages
```

### Test User Creation Failed

**Possible Causes:**
- User already exists
- Auth settings disabled signup
- Environment variables missing

**Solutions:**
- Try signing in with existing credentials
- Check Supabase auth configuration
- Verify environment setup

## 🎯 Adding Debug Access to Other Users

### For Your Main Account

```sql
UPDATE user_profiles 
SET debug_mode = TRUE 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

### For Team Members

1. **Each developer** creates their own test account
2. **Admin enables** debug_mode for each account
3. **Individual access** without shared credentials

## 📋 Best Practices

### Development

- **Use test account** for onboarding changes
- **Reset frequently** to ensure clean testing
- **Test both fresh and returning** user experiences
- **Verify mobile responsiveness** of debug panel

### Team Collaboration

- **Document test scenarios** for consistent testing
- **Share test user** credentials securely within team
- **Reset before major testing sessions**
- **Use separate test accounts** for different scenarios

### Production Safety

- **Never enable debug_mode** in production
- **Environment-specific** feature flags
- **Regular audit** of debug access permissions
- **Clean separation** between test and production data

## 🔧 Extending the System

### Adding New Reset Options

```typescript
// In reset-user/route.ts
const resetOptions = {
  resetMessages: true,
  resetPeople: true,
  resetOnboarding: true,
  preservePreferences: false
};
```

### Custom Test Scenarios

```typescript
// New API endpoints for preset scenarios
POST /api/dev/set-scenario/new-manager
POST /api/dev/set-scenario/experienced-user
POST /api/dev/set-scenario/team-lead
```

### Additional Debug Tools

```typescript
// Extend debug panel with:
- User state inspector
- Onboarding step navigator
- Test data generator
- Performance metrics
```

## 📊 Success Metrics

### Development Experience

- ✅ **< 30 seconds** to reset and restart testing
- ✅ **Zero new account creation** needed
- ✅ **Clear visual indicators** of test mode
- ✅ **Safe, isolated** test environment

### Testing Coverage

- ✅ **Fresh user onboarding** easily testable
- ✅ **Different onboarding paths** accessible
- ✅ **Edge cases and errors** reproducible
- ✅ **Mobile and desktop** both supported

The onboarding test system transforms development testing from a slow, account-creation heavy process into a fast, iterative workflow that encourages thorough testing of the user experience. 