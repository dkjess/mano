-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversation embeddings table
CREATE TABLE conversation_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 embedding size
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  metadata JSONB DEFAULT '{}'
);

-- Conversation summary embeddings (for longer-term context)
CREATE TABLE conversation_summary_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('daily', 'weekly', 'theme')),
  summary_content TEXT NOT NULL,
  embedding vector(1536),
  time_range_start TIMESTAMP WITH TIME ZONE,
  time_range_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for vector similarity search
CREATE INDEX conversation_embeddings_user_vector_idx 
ON conversation_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX conversation_summary_embeddings_user_vector_idx 
ON conversation_summary_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Regular indexes for filtering
CREATE INDEX conversation_embeddings_user_id_idx ON conversation_embeddings (user_id);
CREATE INDEX conversation_embeddings_person_id_idx ON conversation_embeddings (person_id);
CREATE INDEX conversation_embeddings_created_at_idx ON conversation_embeddings (created_at DESC);

CREATE INDEX conversation_summary_embeddings_user_id_idx ON conversation_summary_embeddings (user_id);
CREATE INDEX conversation_summary_embeddings_person_id_idx ON conversation_summary_embeddings (person_id);

-- Row Level Security
ALTER TABLE conversation_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summary_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own embeddings" 
ON conversation_embeddings FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own summary embeddings" 
ON conversation_summary_embeddings FOR ALL 
USING (auth.uid() = user_id);

-- Vector similarity search functions
CREATE OR REPLACE FUNCTION match_conversation_embeddings(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  person_filter text DEFAULT NULL
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
    AND 1 - (conversation_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY conversation_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_conversation_summaries(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  summary_content text,
  person_id text,
  summary_type text,
  time_range_start timestamp with time zone,
  time_range_end timestamp with time zone,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    conversation_summary_embeddings.id,
    conversation_summary_embeddings.summary_content,
    conversation_summary_embeddings.person_id,
    conversation_summary_embeddings.summary_type,
    conversation_summary_embeddings.time_range_start,
    conversation_summary_embeddings.time_range_end,
    1 - (conversation_summary_embeddings.embedding <=> query_embedding) AS similarity,
    conversation_summary_embeddings.metadata
  FROM conversation_summary_embeddings
  WHERE conversation_summary_embeddings.user_id = match_user_id
    AND 1 - (conversation_summary_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY conversation_summary_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$; 