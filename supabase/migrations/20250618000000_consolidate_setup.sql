-- Simplified migration to create user_profiles table and functions
-- Avoiding message policy issues that cause UUID parsing errors

-- Ensure user_profiles table exists with all required columns
DO $$
BEGIN
    -- Create table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_name = 'user_profiles' 
                   AND table_schema = 'public') THEN
        CREATE TABLE user_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
          preferred_name TEXT,
          call_name TEXT,
          job_role TEXT,
          company TEXT,
          onboarding_completed BOOLEAN DEFAULT FALSE,
          onboarding_step INTEGER DEFAULT 0,
          debug_mode BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        );
    END IF;

    -- Add debug_mode column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' 
                   AND column_name = 'debug_mode' 
                   AND table_schema = 'public') THEN
        ALTER TABLE user_profiles ADD COLUMN debug_mode BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add call_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' 
                   AND column_name = 'call_name' 
                   AND table_schema = 'public') THEN
        ALTER TABLE user_profiles ADD COLUMN call_name TEXT;
    END IF;
    
    -- Add job_role column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' 
                   AND column_name = 'job_role' 
                   AND table_schema = 'public') THEN
        ALTER TABLE user_profiles ADD COLUMN job_role TEXT;
    END IF;
    
    -- Add company column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' 
                   AND column_name = 'company' 
                   AND table_schema = 'public') THEN
        ALTER TABLE user_profiles ADD COLUMN company TEXT;
    END IF;
    
    -- Update onboarding_step type to integer if it's text
    BEGIN
        -- Check if onboarding_step is text type and convert to integer
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' 
                   AND column_name = 'onboarding_step' 
                   AND data_type = 'text'
                   AND table_schema = 'public') THEN
            -- Drop existing column and recreate as integer
            ALTER TABLE user_profiles DROP COLUMN onboarding_step;
            ALTER TABLE user_profiles ADD COLUMN onboarding_step INTEGER DEFAULT 0;
        END IF;
    END;

    -- Add user_id column to messages table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' 
                   AND column_name = 'user_id' 
                   AND table_schema = 'public') THEN
        ALTER TABLE messages ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate user_profiles policies
DROP POLICY IF EXISTS "Users can only access their own profile" ON user_profiles;
CREATE POLICY "Users can only access their own profile" 
ON user_profiles FOR ALL 
USING (auth.uid() = user_id);

-- Create or replace trigger functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create index for debug_mode queries
CREATE INDEX IF NOT EXISTS user_profiles_debug_mode_idx ON user_profiles (debug_mode) WHERE debug_mode = true;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.debug_mode IS 'Enable debug access for development testing features'; 