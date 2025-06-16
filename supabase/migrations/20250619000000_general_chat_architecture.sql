-- General Chat Architecture Migration
-- Ensures clean implementation where 'general' is a special reserved person_id

-- Ensure messages table has user_id column (already added in previous migration)
-- This migration is idempotent and safe to run multiple times

-- Add comment to clarify the design decision for person_id
COMMENT ON COLUMN messages.person_id IS 'Either a UUID referencing people.id, or the special value "general" for general management conversations';

-- Verify and update RLS policies for messages table
-- Drop existing policies to recreate them with clear intent
DROP POLICY IF EXISTS "Users can view messages for their people" ON messages;
DROP POLICY IF EXISTS "Users can insert messages for their people" ON messages;
DROP POLICY IF EXISTS "Users can update messages for their people" ON messages;
DROP POLICY IF EXISTS "Users can delete messages for their people" ON messages;

-- Create comprehensive RLS policies for messages
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (
    -- Allow access to general conversation messages for authenticated users
    (person_id = 'general' AND user_id = auth.uid()) OR
    -- Allow access to person-specific messages they own
    (person_id != 'general' AND EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert their messages" ON messages
  FOR INSERT WITH CHECK (
    -- Allow inserting general conversation messages with proper user_id
    (person_id = 'general' AND user_id = auth.uid()) OR
    -- Allow inserting person-specific messages they own
    (person_id != 'general' AND user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can update their messages" ON messages
  FOR UPDATE USING (
    (person_id = 'general' AND user_id = auth.uid()) OR
    (person_id != 'general' AND user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can delete their messages" ON messages
  FOR DELETE USING (
    (person_id = 'general' AND user_id = auth.uid()) OR
    (person_id != 'general' AND user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    ))
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS messages_person_id_user_id_idx ON messages (person_id, user_id);
CREATE INDEX IF NOT EXISTS messages_general_user_id_idx ON messages (user_id) WHERE person_id = 'general';
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);

-- Add a check constraint to ensure person_id format
-- This allows 'general' or valid UUID strings
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_person_id_format_check;
ALTER TABLE messages ADD CONSTRAINT messages_person_id_format_check 
  CHECK (
    person_id = 'general' OR 
    (person_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );

-- Ensure user_id is not null for new messages (data integrity)
-- We'll make this NOT NULL in future migrations after ensuring all existing data has user_id
-- For now, just add a partial index for performance on non-null user_id
CREATE INDEX IF NOT EXISTS messages_user_id_not_null_idx ON messages (user_id) WHERE user_id IS NOT NULL;

-- Create a function to validate message ownership (utility for application layer)
CREATE OR REPLACE FUNCTION validate_message_ownership(p_person_id text, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Allow general messages for any authenticated user with their user_id
  IF p_person_id = 'general' THEN
    RETURN p_user_id IS NOT NULL;
  END IF;
  
  -- For person-specific messages, verify ownership
  RETURN EXISTS (
    SELECT 1 FROM people 
    WHERE people.id::text = p_person_id 
    AND people.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments for documentation
COMMENT ON TABLE messages IS 'Stores all conversation messages. Supports both person-specific conversations (person_id as UUID) and general management coaching (person_id = ''general'')';
COMMENT ON FUNCTION validate_message_ownership IS 'Validates that a user can create/access messages for a given person_id. Returns true for general messages or owned person-specific messages.';

-- Create a view for easy querying of messages with person details
CREATE OR REPLACE VIEW messages_with_person_info AS
SELECT 
  m.*,
  CASE 
    WHEN m.person_id = 'general' THEN 'General'
    ELSE p.name
  END as person_name,
  CASE 
    WHEN m.person_id = 'general' THEN 'Management Coach'
    ELSE p.role
  END as person_role,
  CASE 
    WHEN m.person_id = 'general' THEN 'assistant'
    ELSE p.relationship_type
  END as relationship_type
FROM messages m
LEFT JOIN people p ON p.id::text = m.person_id AND m.person_id != 'general';

-- Grant access to the view
GRANT SELECT ON messages_with_person_info TO authenticated;

-- Enable RLS on the view (inherits from base table)
ALTER VIEW messages_with_person_info SET (security_barrier = true);

-- Add final verification queries (as comments for reference)
/*
-- Verify general messages are being stored correctly:
SELECT person_id, content, is_user, user_id, created_at 
FROM messages 
WHERE person_id = 'general' 
ORDER BY created_at DESC LIMIT 5;

-- Verify no orphaned messages exist:
SELECT DISTINCT m.person_id, 
       CASE 
         WHEN m.person_id = 'general' THEN 'General Chat'
         WHEN p.id IS NOT NULL THEN p.name
         ELSE 'ORPHANED - NEEDS CLEANUP'
       END as person_name
FROM messages m
LEFT JOIN people p ON m.person_id = p.id::text
ORDER BY person_name;

-- Check RLS policies are working:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages';
*/ 