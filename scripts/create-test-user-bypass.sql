-- Temporarily disable the trigger
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Create test user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  deleted_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'testuser@example.com',
  crypt('testuser123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  NULL
);

-- Get the user ID
WITH new_user AS (
  SELECT id FROM auth.users WHERE email = 'testuser@example.com'
)
-- Create user profile
INSERT INTO user_profiles (user_id)
SELECT id FROM new_user;

-- Create General topic
WITH new_user AS (
  SELECT id FROM auth.users WHERE email = 'testuser@example.com'
)
INSERT INTO topics (title, participants, created_by, status)
SELECT 'General', '[]'::jsonb, id, 'active' FROM new_user;

-- Re-enable the trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;