BEGIN;

-- Remove the NOT NULL constraint from person_id
ALTER TABLE messages ALTER COLUMN person_id DROP NOT NULL;

-- Update the existing constraint to handle the NULL case properly
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_reference_check;

-- Add updated constraint that handles NULL person_id correctly
ALTER TABLE messages 
ADD CONSTRAINT messages_reference_check 
  CHECK (
    -- Person messages: person_id is set (not null) and topic_id is null
    (person_id IS NOT NULL AND topic_id IS NULL) OR 
    -- Topic messages: topic_id is set (not null) and person_id is null
    (topic_id IS NOT NULL AND person_id IS NULL)
  );

COMMIT; 