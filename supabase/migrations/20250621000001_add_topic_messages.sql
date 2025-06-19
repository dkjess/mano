BEGIN;

-- Add topic_id to messages
ALTER TABLE messages 
ADD COLUMN topic_id UUID REFERENCES topics(id) ON DELETE CASCADE;

-- Add constraint to ensure messages reference either person OR topic (or general)
ALTER TABLE messages 
ADD CONSTRAINT messages_reference_check 
  CHECK (
    (person_id IS NOT NULL AND topic_id IS NULL) OR 
    (person_id IS NULL AND topic_id IS NOT NULL) OR
    (person_id = 'general' AND topic_id IS NULL)
  );

-- Add index for topic messages
CREATE INDEX idx_messages_topic_id ON messages(topic_id);

COMMIT; 