BEGIN;

-- Add topic_id column to conversation_embeddings table
ALTER TABLE conversation_embeddings 
ADD COLUMN topic_id UUID REFERENCES topics(id) ON DELETE CASCADE;

-- Create index for topic_id
CREATE INDEX conversation_embeddings_topic_id_idx ON conversation_embeddings (topic_id);

-- Update the match_conversation_embeddings function to support topic filtering
CREATE OR REPLACE FUNCTION match_conversation_embeddings(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  person_filter text DEFAULT NULL,
  topic_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  person_id text,
  message_type text,
  created_at timestamp with time zone,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    conversation_embeddings.id,
    conversation_embeddings.content,
    conversation_embeddings.person_id,
    conversation_embeddings.message_type,
    conversation_embeddings.created_at,
    1 - (conversation_embeddings.embedding <=> query_embedding) AS similarity,
    conversation_embeddings.metadata
  FROM conversation_embeddings
  WHERE conversation_embeddings.user_id = match_user_id
    AND (person_filter IS NULL OR conversation_embeddings.person_id = person_filter)
    AND (topic_filter IS NULL OR conversation_embeddings.topic_id::text = topic_filter)
    AND 1 - (conversation_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY conversation_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMIT;