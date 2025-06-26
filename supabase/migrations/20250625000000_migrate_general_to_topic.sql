-- Migration: Convert 'general' chat from virtual person to proper topic
-- Date: 2025-06-25
-- Description: This migration converts the special 'general' person_id to a proper topic
-- for each user, migrating existing messages and updating constraints/policies.

BEGIN;

-- First, let's understand what we're migrating
-- Comment out the following lines when ready to execute (they're for planning purposes)
/*
SELECT 
  COUNT(*) as total_general_messages,
  COUNT(DISTINCT user_id) as users_with_general_messages
FROM messages 
WHERE person_id = 'general';
*/

-- Step 1: Create a 'General' topic for each user who has general messages
-- This ensures we don't create empty topics for users who never used general chat
INSERT INTO topics (title, participants, created_by, status, created_at, updated_at)
SELECT 
  'General' as title,
  '[]'::jsonb as participants, -- Empty participants array for general coaching
  user_id as created_by,
  'active' as status,
  MIN(created_at) as created_at, -- Use the earliest message date as topic creation
  MAX(created_at) as updated_at  -- Use the latest message date as topic update
FROM messages 
WHERE person_id = 'general' 
  AND user_id IS NOT NULL
GROUP BY user_id;

-- Step 2: Update messages to reference the new General topic instead of person_id='general'
-- We need to match each user's general messages to their newly created General topic
UPDATE messages 
SET 
  topic_id = t.id,
  person_id = NULL
FROM topics t
WHERE messages.person_id = 'general'
  AND messages.user_id = t.created_by
  AND t.title = 'General';

-- Step 3: Verify the migration worked (this will show 0 if successful)
-- Comment out when ready to execute
/*
SELECT COUNT(*) as remaining_general_messages 
FROM messages 
WHERE person_id = 'general';
*/

-- Step 4: Update the messages table constraint to no longer allow 'general' as person_id
-- First, drop the old constraint that allowed 'general'
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_person_id_format_check;

-- Add new constraint that only allows valid UUIDs for person_id (no more 'general')
ALTER TABLE messages ADD CONSTRAINT messages_person_id_format_check 
  CHECK (
    person_id IS NULL OR 
    (person_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );

-- Step 5: Update the messages reference constraint to be more explicit
-- Drop the old constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_reference_check;

-- Add updated constraint that ensures messages reference either person OR topic (but not both)
ALTER TABLE messages ADD CONSTRAINT messages_reference_check 
  CHECK (
    -- Person messages: person_id is set (not null) and topic_id is null
    (person_id IS NOT NULL AND topic_id IS NULL) OR 
    -- Topic messages: topic_id is set (not null) and person_id is null
    (topic_id IS NOT NULL AND person_id IS NULL)
  );

-- Step 6: Update RLS policies to remove special 'general' handling
-- Drop existing message policies
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can insert their messages" ON messages;
DROP POLICY IF EXISTS "Users can update their messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their messages" ON messages;

-- Create new simplified policies without 'general' special cases
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (
    user_id = auth.uid() AND (
      -- Allow access to person-specific messages they own
      (person_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM people 
        WHERE people.id::text = messages.person_id 
        AND people.user_id = auth.uid()
      )) OR
      -- Allow access to topic messages they own
      (topic_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM topics 
        WHERE topics.id = messages.topic_id 
        AND topics.created_by = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can insert their messages" ON messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND (
      -- Allow inserting person-specific messages they own
      (person_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM people 
        WHERE people.id::text = person_id 
        AND people.user_id = auth.uid()
      )) OR
      -- Allow inserting topic messages they own
      (topic_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM topics 
        WHERE topics.id = topic_id 
        AND topics.created_by = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can update their messages" ON messages
  FOR UPDATE USING (
    user_id = auth.uid() AND (
      -- Allow updating person-specific messages they own
      (person_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM people 
        WHERE people.id::text = person_id 
        AND people.user_id = auth.uid()
      )) OR
      -- Allow updating topic messages they own
      (topic_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM topics 
        WHERE topics.id = topic_id 
        AND topics.created_by = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can delete their messages" ON messages
  FOR DELETE USING (
    user_id = auth.uid() AND (
      -- Allow deleting person-specific messages they own
      (person_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM people 
        WHERE people.id::text = person_id 
        AND people.user_id = auth.uid()
      )) OR
      -- Allow deleting topic messages they own
      (topic_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM topics 
        WHERE topics.id = topic_id 
        AND topics.created_by = auth.uid()
      ))
    )
  );

-- Step 7: Add RLS policies for topics table if they don't exist
-- Enable RLS on topics if not already enabled
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for topics
DROP POLICY IF EXISTS "Users can view their topics" ON topics;
DROP POLICY IF EXISTS "Users can insert their topics" ON topics;
DROP POLICY IF EXISTS "Users can update their topics" ON topics;
DROP POLICY IF EXISTS "Users can delete their topics" ON topics;

CREATE POLICY "Users can view their topics" ON topics
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can insert their topics" ON topics
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their topics" ON topics
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their topics" ON topics
  FOR DELETE USING (created_by = auth.uid());

-- Step 8: Update the messages_with_person_info view to handle the new structure
DROP VIEW IF EXISTS messages_with_person_info;

CREATE OR REPLACE VIEW messages_with_person_info AS
SELECT 
  m.*,
  CASE 
    WHEN m.person_id IS NOT NULL THEN p.name
    WHEN m.topic_id IS NOT NULL THEN t.title
    ELSE 'Unknown'
  END as person_name,
  CASE 
    WHEN m.person_id IS NOT NULL THEN p.role
    WHEN m.topic_id IS NOT NULL AND t.title = 'General' THEN 'Management Coaching'
    WHEN m.topic_id IS NOT NULL THEN 'Topic Discussion'
    ELSE 'Unknown'
  END as person_role,
  CASE 
    WHEN m.person_id IS NOT NULL THEN p.relationship_type
    WHEN m.topic_id IS NOT NULL AND t.title = 'General' THEN 'assistant'
    WHEN m.topic_id IS NOT NULL THEN 'topic'
    ELSE 'unknown'
  END as relationship_type,
  CASE 
    WHEN m.person_id IS NOT NULL THEN 'person'
    WHEN m.topic_id IS NOT NULL THEN 'topic'
    ELSE 'unknown'
  END as message_type
FROM messages m
LEFT JOIN people p ON (m.person_id IS NOT NULL AND p.id::text = m.person_id)
LEFT JOIN topics t ON (m.topic_id IS NOT NULL AND t.id = m.topic_id);

-- Grant access to the updated view
GRANT SELECT ON messages_with_person_info TO authenticated;

-- Enable RLS on the view (inherits from base tables)
ALTER VIEW messages_with_person_info SET (security_barrier = true);

-- Step 9: Remove the old validation function that was specific to 'general'
DROP FUNCTION IF EXISTS validate_message_ownership(text, uuid);

-- Create new validation function that works with both people and topics
CREATE OR REPLACE FUNCTION validate_message_ownership(p_person_id text, p_topic_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- For person-specific messages, verify ownership
  IF p_person_id IS NOT NULL AND p_topic_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = p_person_id 
      AND people.user_id = p_user_id
    );
  END IF;
  
  -- For topic messages, verify ownership
  IF p_topic_id IS NOT NULL AND p_person_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM topics 
      WHERE topics.id = p_topic_id 
      AND topics.created_by = p_user_id
    );
  END IF;
  
  -- Invalid state: both or neither are set
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create indexes for better performance with the new structure
CREATE INDEX IF NOT EXISTS messages_topic_id_user_id_idx ON messages (topic_id, user_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS topics_created_by_title_idx ON topics (created_by, title);
CREATE INDEX IF NOT EXISTS topics_title_idx ON topics (title) WHERE title = 'General';

-- Step 11: Update conversation embeddings to reference the new topic structure
-- Update conversation_embeddings table to use topic IDs instead of 'general'
UPDATE conversation_embeddings 
SET person_id = t.id::text
FROM topics t
WHERE conversation_embeddings.person_id = 'general'
  AND conversation_embeddings.user_id = t.created_by
  AND t.title = 'General';

-- Update conversation_summary_embeddings table similarly
UPDATE conversation_summary_embeddings 
SET person_id = t.id::text
FROM topics t
WHERE conversation_summary_embeddings.person_id = 'general'
  AND conversation_summary_embeddings.user_id = t.created_by
  AND t.title = 'General';

-- Step 12: Add helpful comments for documentation
COMMENT ON COLUMN messages.person_id IS 'UUID referencing people.id for person-specific conversations. NULL for topic conversations.';
COMMENT ON COLUMN messages.topic_id IS 'UUID referencing topics.id for topic conversations. NULL for person-specific conversations.';
COMMENT ON TABLE topics IS 'Conversation topics including the General management coaching topic and custom user topics.';
COMMENT ON FUNCTION validate_message_ownership IS 'Validates that a user can create/access messages for a given person_id or topic_id.';

-- Step 13: Final verification queries (comment out when executing)
/*
-- Verify all general messages were migrated
SELECT 
  'Messages with person_id=general remaining' as check_type,
  COUNT(*) as count
FROM messages 
WHERE person_id = 'general'

UNION ALL

-- Verify General topics were created
SELECT 
  'General topics created' as check_type,
  COUNT(*) as count
FROM topics 
WHERE title = 'General'

UNION ALL

-- Verify message distribution
SELECT 
  'Total messages' as check_type,
  COUNT(*) as count
FROM messages

UNION ALL

SELECT 
  'Person messages' as check_type,
  COUNT(*) as count
FROM messages 
WHERE person_id IS NOT NULL

UNION ALL

SELECT 
  'Topic messages' as check_type,
  COUNT(*) as count
FROM messages 
WHERE topic_id IS NOT NULL;
*/

COMMIT;

-- Post-migration notes:
-- 1. Frontend code will need to be updated to route /people/general to /topics/[generalTopicId]
-- 2. API endpoints will need to handle the General topic as a special case
-- 3. Vector search functions may need updates to handle topic IDs instead of 'general'
-- 4. The sidebar will need to be updated to show General as a topic instead of a person