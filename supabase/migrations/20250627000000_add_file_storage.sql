BEGIN;

-- Create message_files table for file attachments
CREATE TABLE message_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL, -- Unique filename in storage
  original_name TEXT NOT NULL, -- Original filename from user
  file_type TEXT NOT NULL, -- 'image', 'document', 'transcript', etc.
  content_type TEXT NOT NULL, -- MIME type (image/jpeg, application/pdf, etc.)
  file_size BIGINT NOT NULL, -- File size in bytes
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  metadata JSONB DEFAULT '{}', -- Additional metadata (dimensions, duration, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_message_files_message_id ON message_files(message_id);
CREATE INDEX idx_message_files_user_id ON message_files(user_id);
CREATE INDEX idx_message_files_file_type ON message_files(file_type);
CREATE INDEX idx_message_files_created_at ON message_files(created_at);

-- Enable RLS
ALTER TABLE message_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_files
CREATE POLICY "Users can view their own files" ON message_files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files" ON message_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files" ON message_files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" ON message_files
  FOR DELETE USING (auth.uid() = user_id);

-- Add file_count column to messages for easier querying
ALTER TABLE messages ADD COLUMN file_count INTEGER DEFAULT 0;

-- Create function to update file count
CREATE OR REPLACE FUNCTION update_message_file_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE messages 
    SET file_count = file_count + 1 
    WHERE id = NEW.message_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE messages 
    SET file_count = file_count - 1 
    WHERE id = OLD.message_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to maintain file count
CREATE TRIGGER trigger_update_file_count_insert
  AFTER INSERT ON message_files
  FOR EACH ROW EXECUTE FUNCTION update_message_file_count();

CREATE TRIGGER trigger_update_file_count_delete
  AFTER DELETE ON message_files
  FOR EACH ROW EXECUTE FUNCTION update_message_file_count();

-- Create function to clean up orphaned files (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM message_files 
  WHERE message_id NOT IN (SELECT id FROM messages);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;