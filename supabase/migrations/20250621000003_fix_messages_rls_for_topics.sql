BEGIN;

-- Drop existing policies for messages
DROP POLICY IF EXISTS "Users can view messages for their people" ON messages;
DROP POLICY IF EXISTS "Users can insert messages for their people" ON messages;

-- Drop any existing policies with the new names
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can insert their messages" ON messages;

-- Create new policies that handle both people and topics
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (
    -- General messages
    person_id = 'general' OR
    -- Messages for their people
    EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    ) OR
    -- Messages for their topics
    EXISTS (
      SELECT 1 FROM topics 
      WHERE topics.id = messages.topic_id 
      AND topics.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert their messages" ON messages
  FOR INSERT WITH CHECK (
    -- General messages
    person_id = 'general' OR
    -- Messages for their people
    EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    ) OR
    -- Messages for their topics
    EXISTS (
      SELECT 1 FROM topics 
      WHERE topics.id = messages.topic_id 
      AND topics.created_by = auth.uid()
    )
  );

COMMIT; 