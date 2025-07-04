-- Add onboarding fields to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS call_name TEXT,
ADD COLUMN IF NOT EXISTS job_role TEXT,
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auth_method TEXT;

-- Update onboarding_step to be integer for easier tracking
ALTER TABLE user_profiles 
DROP COLUMN IF EXISTS onboarding_step;

ALTER TABLE user_profiles 
ADD COLUMN onboarding_step INTEGER DEFAULT 0;

-- Create index for faster onboarding status checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding 
ON user_profiles(user_id, onboarding_completed);

-- Update the handle_new_user function to set auth method and email verification status
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (user_id, auth_method, email_verified)
  VALUES (
    new.id,
    CASE 
      WHEN new.raw_app_meta_data->>'provider' = 'google' THEN 'google'
      WHEN new.raw_app_meta_data->>'provider' = 'email' THEN 'email'
      ELSE 'email'
    END,
    CASE 
      WHEN new.raw_app_meta_data->>'provider' = 'google' THEN true
      ELSE false
    END
  );
  
  -- Create a general topic for the user
  INSERT INTO public.topics (created_by, title)
  VALUES (new.id, 'General');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for the new fields
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only update their own profile
CREATE POLICY "Users can update own profile onboarding fields" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);