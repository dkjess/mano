-- Migration: Add file content search function
-- Date: 2025-06-28
-- Description: PostgreSQL function for semantic search through file content embeddings

BEGIN;

-- Function to search file content embeddings
CREATE OR REPLACE FUNCTION match_file_content_embeddings(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  file_filter uuid DEFAULT NULL,
  person_filter uuid DEFAULT NULL,
  topic_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  person_id uuid,
  topic_id uuid,
  message_id uuid,
  file_id uuid,
  message_type text,
  created_at timestamptz,
  similarity float,
  metadata jsonb,
  content_type text,
  chunk_index int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    conversation_embeddings.id,
    conversation_embeddings.content,
    conversation_embeddings.person_id,
    conversation_embeddings.topic_id,
    conversation_embeddings.message_id,
    conversation_embeddings.file_id,
    conversation_embeddings.message_type,
    conversation_embeddings.created_at,
    (conversation_embeddings.embedding <#> query_embedding) * -1 AS similarity,
    conversation_embeddings.metadata,
    conversation_embeddings.content_type,
    conversation_embeddings.chunk_index
  FROM conversation_embeddings
  WHERE conversation_embeddings.user_id = match_user_id
    AND conversation_embeddings.content_type IN ('file_content', 'file_chunk')
    AND (conversation_embeddings.embedding <#> query_embedding) * -1 > match_threshold
    AND (file_filter IS NULL OR conversation_embeddings.file_id = file_filter)
    AND (person_filter IS NULL OR conversation_embeddings.person_id = person_filter)
    AND (topic_filter IS NULL OR conversation_embeddings.topic_id = topic_filter)
  ORDER BY conversation_embeddings.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_file_content_embeddings TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION match_file_content_embeddings IS 'Search file content embeddings using vector similarity';

COMMIT;