-- Migration: Extend conversation_embeddings for file content
-- Date: 2025-06-28  
-- Description: Adds file content support to existing vector search system

BEGIN;

-- Add file content support to conversation_embeddings
ALTER TABLE conversation_embeddings 
ADD COLUMN file_id UUID REFERENCES message_files(id) ON DELETE CASCADE,
ADD COLUMN content_type TEXT DEFAULT 'message',
ADD COLUMN chunk_index INTEGER DEFAULT 0;

-- Add check constraint for content_type
ALTER TABLE conversation_embeddings 
ADD CONSTRAINT chk_content_type 
CHECK (content_type IN ('message', 'file_content', 'file_chunk'));

-- Index for efficient file content searches
CREATE INDEX idx_conversation_embeddings_file_content 
ON conversation_embeddings (user_id, content_type, file_id);

-- Index for chunk ordering
CREATE INDEX idx_conversation_embeddings_chunks 
ON conversation_embeddings (file_id, chunk_index) 
WHERE content_type IN ('file_content', 'file_chunk');

-- Update existing records to have correct content_type
UPDATE conversation_embeddings 
SET content_type = 'message'
WHERE content_type IS NULL OR content_type = '';

-- Add helpful comments
COMMENT ON COLUMN conversation_embeddings.file_id IS 'Reference to message_files for file content embeddings';
COMMENT ON COLUMN conversation_embeddings.content_type IS 'Type of content: message, file_content, or file_chunk';
COMMENT ON COLUMN conversation_embeddings.chunk_index IS 'For large files split into chunks, 0-based index';

COMMIT;