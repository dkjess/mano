BEGIN;

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'message-attachments', 
  'message-attachments', 
  false,
  26214400, -- 25MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
    'application/json', 'text/vtt', 'text/x-vtt',
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Note: Storage RLS policies are managed through Supabase Dashboard or supabase CLI
-- The storage.objects table RLS is already enabled by default in newer Supabase versions
-- Policies will need to be created through the dashboard or API

COMMIT;