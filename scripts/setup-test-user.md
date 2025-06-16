# Test User Setup Guide

## Overview
This guide helps you set up the debug test user system for Mano development.

## Quick Setup Steps

### 1. Run Database Migration
Apply the debug_mode column migration:

```bash
# If using Supabase CLI
npx supabase migration up

# Or apply manually in Supabase SQL Editor:
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS debug_mode BOOLEAN DEFAULT FALSE;
```

### 2. Create Test User Account
1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Go to the login page**: http://localhost:3000/auth/login

3. **Create the test account**:
   - Click "Sign up" 
   - Use these credentials:
     - **Email**: `test@mano.dev`
     - **Password**: `testuser123`

### 3. Enable Debug Mode in Supabase
1. **Open Supabase Dashboard** → Table Editor → `user_profiles`
2. **Find the test user row** (email: test@mano.dev)
3. **Edit the row** and set `debug_mode` to `true`
4. **Save changes**

### 4. Test the Debug Panel
1. **Sign in as test user** (test@mano.dev / testuser123)
2. **Look for the 🐛 button** in the bottom right corner
3. **Click to open the debug panel**
4. **Test the reset functionality**

## Adding Debug Access to Other Users

To give debug access to your main account or other users:

**Option 1: Via Supabase Dashboard**
1. Go to Table Editor → `user_profiles`
2. Find the user by email
3. Set `debug_mode` to `true`

**Option 2: Via SQL**
```sql
-- In Supabase SQL Editor
UPDATE user_profiles 
SET debug_mode = TRUE 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

## Usage Workflow

### Testing Onboarding Flow:
1. **Sign in as debug user**
2. **Open debug panel** (🐛 button)
3. **Click "Reset Test Data"**
4. **Confirm reset**
5. **You'll be redirected to onboarding**
6. **Test your changes**
7. **Repeat as needed**

### Security Notes:
- ✅ Debug panel only appears for users with `debug_mode = true`
- ✅ Reset API requires debug access verification
- ✅ All operations are logged for audit trail
- ✅ Test user credentials are isolated and safe for development

## Troubleshooting

### Debug Panel Not Appearing?
- Check that `debug_mode = true` in user_profiles table
- Verify you're signed in as the correct user
- Check browser console for any errors

### Reset Not Working?
- Ensure user has debug_mode enabled
- Check server logs for error details
- Verify all database tables exist

### Can't Create Test User?
- User might already exist - try signing in directly
- Check Supabase auth settings allow signups
- Verify environment variables are set

## Development Tips

- The debug panel remembers its open/closed state per session
- Reset clears ALL user data but preserves debug access
- You can have multiple debug users for different test scenarios
- The system works in both local development and staging environments 