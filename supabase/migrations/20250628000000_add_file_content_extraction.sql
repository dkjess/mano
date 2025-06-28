-- Migration: Add file content extraction support
-- Date: 2025-06-28
-- Description: Extends message_files table to support text extraction and content storage

BEGIN;

-- Add content extraction columns to message_files table
ALTER TABLE message_files 
ADD COLUMN extracted_content TEXT,
ADD COLUMN content_hash TEXT,
ADD COLUMN processing_status TEXT DEFAULT 'pending',
ADD COLUMN processed_at TIMESTAMPTZ;

-- Add index on processing_status for efficient queries
CREATE INDEX idx_message_files_processing_status 
ON message_files (processing_status, created_at);

-- Add index on content_hash for deduplication
CREATE INDEX idx_message_files_content_hash 
ON message_files (content_hash) WHERE content_hash IS NOT NULL;

-- Update processing status for existing files to 'pending'
UPDATE message_files 
SET processing_status = 'pending'
WHERE processing_status IS NULL;

-- Add helpful comments
COMMENT ON COLUMN message_files.extracted_content IS 'Text content extracted from uploaded files';
COMMENT ON COLUMN message_files.content_hash IS 'Hash of extracted content for deduplication';
COMMENT ON COLUMN message_files.processing_status IS 'Status: pending, processing, completed, failed';
COMMENT ON COLUMN message_files.processed_at IS 'When content extraction was completed';

COMMIT;