-- Migration: Fix user creation trigger
-- Date: 2025-06-28
-- Description: Fixes the handle_new_user() trigger function to properly insert into topics table

BEGIN;

-- Fix the user creation trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile (existing functionality)
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.id);
  
  -- Create General topic for the new user with correct column mapping
  INSERT INTO topics (title, status, participants, created_by)
  VALUES (
    'General',
    'active',
    '[]'::jsonb,
    NEW.id
  );
  
  RETURN NEW;
EXCEPTION 
  WHEN OTHERS THEN
    -- Log the error but don't fail user creation
    RAISE WARNING 'Failed to create user profile or topic for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment
COMMENT ON FUNCTION handle_new_user IS 'Creates user profile and General topic when a new user signs up (with error handling)';

COMMIT;