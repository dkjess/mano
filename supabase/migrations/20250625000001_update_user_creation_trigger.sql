-- Migration: Update user creation trigger to create General topic
-- Date: 2025-06-25
-- Description: Updates the handle_new_user() trigger function to automatically
-- create a General topic when a new user profile is created.

BEGIN;

-- Update the user creation trigger function to also create a General topic
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile (existing functionality)
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.id);
  
  -- Create General topic for the new user
  INSERT INTO topics (title, participants, created_by, status)
  VALUES (
    'General',
    '[]'::jsonb,
    NEW.id,
    'active'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger itself doesn't need to be recreated as it already exists
-- and points to the updated function

-- Add helpful comment
COMMENT ON FUNCTION handle_new_user IS 'Creates user profile and General topic when a new user signs up';

COMMIT;