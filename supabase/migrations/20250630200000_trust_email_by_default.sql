-- Update existing users to have email_verified = true
UPDATE user_profiles SET email_verified = true WHERE email_verified = false;

-- Update the handle_new_user function to always mark email as verified
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create user profile with email always verified
  INSERT INTO public.user_profiles (user_id, auth_method, email_verified)
  VALUES (
    new.id,
    CASE 
      WHEN new.raw_app_meta_data->>'provider' = 'google' THEN 'google'
      WHEN new.raw_app_meta_data->>'provider' = 'email' THEN 'email'
      ELSE 'email'
    END,
    true  -- Always mark email as verified
  );
  
  -- Create a general topic for the user
  INSERT INTO public.topics (created_by, title)
  VALUES (new.id, 'General');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;