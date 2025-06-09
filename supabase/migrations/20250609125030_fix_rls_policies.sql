-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own people" ON people;
DROP POLICY IF EXISTS "Users can insert their own people" ON people;
DROP POLICY IF EXISTS "Users can update their own people" ON people;
DROP POLICY IF EXISTS "Users can delete their own people" ON people;

-- Recreate policies with correct syntax
CREATE POLICY "Users can view their own people" ON people
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own people" ON people
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own people" ON people
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own people" ON people
  FOR DELETE USING (auth.uid() = user_id);

-- Same for messages
DROP POLICY IF EXISTS "Users can view messages for their people" ON messages;
DROP POLICY IF EXISTS "Users can insert messages for their people" ON messages;

CREATE POLICY "Users can view messages for their people" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM people 
      WHERE people.id = messages.person_id 
      AND people.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages for their people" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM people 
      WHERE people.id = messages.person_id 
      AND people.user_id = auth.uid()
    )
  );