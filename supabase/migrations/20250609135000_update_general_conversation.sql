-- Update RLS policies to support 'general' conversation instead of '1-1'

-- Drop existing policies
DROP POLICY IF EXISTS "Users can select their messages" ON messages;
DROP POLICY IF EXISTS "Users can insert their messages" ON messages;
DROP POLICY IF EXISTS "Users can update their messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their messages" ON messages;

-- Recreate policies with support for 'general' conversation
CREATE POLICY "Users can select their messages" ON messages
  FOR SELECT USING (
    person_id = 'general' OR
    EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their messages" ON messages
  FOR INSERT WITH CHECK (
    person_id = 'general' OR
    EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their messages" ON messages
  FOR UPDATE USING (
    person_id = 'general' OR
    EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their messages" ON messages
  FOR DELETE USING (
    person_id = 'general' OR
    EXISTS (
      SELECT 1 FROM people 
      WHERE people.id::text = messages.person_id 
      AND people.user_id = auth.uid()
    )
  ); 