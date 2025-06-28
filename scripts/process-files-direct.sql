-- Script to process pending files directly
-- This bypasses RLS to handle files that need processing

-- First, let's see what files need processing
SELECT 
  id,
  original_name,
  storage_path,
  processing_status,
  content_type
FROM message_files 
WHERE processing_status = 'pending'
ORDER BY created_at DESC;

-- For each pending file, we need to:
-- 1. Download from storage
-- 2. Extract text content
-- 3. Update the database

-- Since we can't download files directly from SQL, let's at least
-- create a helper function that can be called from the application