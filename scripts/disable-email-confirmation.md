# Disable Email Confirmation for Testing

To fix the "Email not confirmed" error, you need to disable email confirmation in your Supabase project:

## Option 1: Disable Email Confirmation (Recommended for Testing)

1. Go to your Supabase Dashboard: https://app.supabase.com/project/zfroutbzdkhivnpiezho
2. Navigate to **Authentication** → **Settings**
3. Scroll down to **User Signups**
4. **Uncheck** "Enable email confirmations"
5. Click **Save**

This will allow users to sign in immediately without email confirmation.

## Option 2: Add Service Role Key (For Production-like Testing)

If you want to keep email confirmation enabled but manually confirm users:

1. Go to **Project Settings** → **API**
2. Copy your **service_role** key (not the anon key)
3. Add it to your `.env.local` file:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
4. Then run: `npx tsx scripts/confirm-test-user.ts`

## Current Test User Credentials

After fixing the email confirmation:
- **Email**: testuser@example.com
- **Password**: testuser123
- **Login URL**: http://localhost:3001/auth/login

## Quick Fix

The fastest solution is **Option 1** - just disable email confirmations in your Supabase dashboard for now. 