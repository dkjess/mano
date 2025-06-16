-- General Chat Architecture Verification Script
-- Run this in Supabase SQL Editor to verify everything is working correctly

-- 1. Check that messages table has correct structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verify RLS policies are correctly set up
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'messages'
ORDER BY policyname;

-- 3. Check indexes for performance
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'messages' 
AND schemaname = 'public';

-- 4. Verify constraint for person_id format
SELECT 
    conname as constraint_name,
    consrc as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
AND contype = 'c';

-- 5. Check if there are any general messages
SELECT 
    COUNT(*) as general_message_count,
    COUNT(DISTINCT user_id) as users_with_general_messages
FROM messages 
WHERE person_id = 'general';

-- 6. Verify no orphaned messages exist
SELECT 
    'Messages with valid person_id' as check_type,
    COUNT(*) as count
FROM messages m
WHERE person_id = 'general' 
   OR EXISTS (SELECT 1 FROM people p WHERE p.id::text = m.person_id)

UNION ALL

SELECT 
    'Orphaned messages (needs cleanup)' as check_type,
    COUNT(*) as count
FROM messages m
WHERE person_id != 'general' 
   AND NOT EXISTS (SELECT 1 FROM people p WHERE p.id::text = m.person_id);

-- 7. Sample general messages (latest 5)
SELECT 
    person_id,
    CASE WHEN is_user THEN 'User' ELSE 'Assistant' END as sender,
    LEFT(content, 100) || '...' as content_preview,
    user_id,
    created_at
FROM messages 
WHERE person_id = 'general' 
ORDER BY created_at DESC 
LIMIT 5;

-- 8. User profiles onboarding status
SELECT 
    onboarding_completed,
    onboarding_step,
    COUNT(*) as user_count
FROM user_profiles 
GROUP BY onboarding_completed, onboarding_step
ORDER BY onboarding_completed, onboarding_step;

-- 9. Check messages_with_person_info view works
SELECT 
    person_id,
    person_name,
    person_role,
    relationship_type,
    COUNT(*) as message_count
FROM messages_with_person_info
GROUP BY person_id, person_name, person_role, relationship_type
ORDER BY 
    CASE WHEN person_id = 'general' THEN 0 ELSE 1 END,
    person_name;

-- 10. Verify helper function works
SELECT 
    'general' as person_id,
    validate_message_ownership('general', auth.uid()) as can_access_general
WHERE auth.uid() IS NOT NULL

UNION ALL

SELECT 
    p.id::text as person_id,
    validate_message_ownership(p.id::text, auth.uid()) as can_access_person
FROM people p 
WHERE p.user_id = auth.uid()
LIMIT 3; 