-- Diagnostic and Fix Script for Messages RLS Policy Issue
-- Run this in Supabase SQL Editor

-- 1. Check current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check current RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages';

-- 3. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables 
WHERE tablename = 'messages';

-- 4. Test data - check if any messages exist without user_id
SELECT 
  id, 
  person_id, 
  user_id, 
  is_user,
  CASE 
    WHEN user_id IS NULL THEN '❌ NULL USER_ID'
    ELSE '✅ HAS USER_ID'
  END as status
FROM messages 
LIMIT 10;

-- 5. Fix: Drop and recreate the INSERT policy with proper checking
DROP POLICY IF EXISTS "Users can insert their messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages for their people" ON messages;

-- Create a more permissive INSERT policy for debugging
CREATE POLICY "Users can insert their messages" ON messages
  FOR INSERT WITH CHECK (
    -- Must have user_id that matches authenticated user
    user_id = auth.uid() AND
    user_id IS NOT NULL AND
    auth.uid() IS NOT NULL AND
    (
      -- Allow general conversations
      person_id = 'general' OR
      -- Allow person-specific conversations they own
      EXISTS (
        SELECT 1 FROM people 
        WHERE people.id::text = person_id 
        AND people.user_id = auth.uid()
      )
    )
  );

-- 6. Also update the SELECT policy to ensure consistency
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages for their people" ON messages;

CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (
    user_id = auth.uid() AND
    user_id IS NOT NULL AND
    auth.uid() IS NOT NULL AND
    (
      person_id = 'general' OR
      EXISTS (
        SELECT 1 FROM people 
        WHERE people.id::text = person_id 
        AND people.user_id = auth.uid()
      )
    )
  );

-- 7. Verify the new policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages' 
ORDER BY policyname;

-- 8. Test query to see if you can select from messages
-- (This should work if you're authenticated)
SELECT COUNT(*) as total_messages,
       COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as messages_with_user_id,
       COUNT(CASE WHEN user_id IS NULL THEN 1 END) as messages_without_user_id
FROM messages; 