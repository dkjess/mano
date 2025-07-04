-- Create cross_conversation_connections table for cross-conversation intelligence
CREATE TABLE cross_conversation_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  person_a_id uuid REFERENCES people(id) ON DELETE CASCADE NOT NULL,
  person_b_id uuid REFERENCES people(id) ON DELETE CASCADE NOT NULL,
  connection_type text NOT NULL CHECK (connection_type IN ('collaboration', 'conflict', 'dependency', 'mentorship', 'shared_challenge')),
  connection_strength real NOT NULL CHECK (connection_strength >= 0 AND connection_strength <= 1),
  description text NOT NULL,
  evidence text[] DEFAULT '{}',
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add RLS policies
ALTER TABLE cross_conversation_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cross conversation connections" ON cross_conversation_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cross conversation connections" ON cross_conversation_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cross conversation connections" ON cross_conversation_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cross conversation connections" ON cross_conversation_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_cross_connections_user_id ON cross_conversation_connections(user_id);
CREATE INDEX idx_cross_connections_person_a ON cross_conversation_connections(person_a_id);
CREATE INDEX idx_cross_connections_person_b ON cross_conversation_connections(person_b_id);
CREATE INDEX idx_cross_connections_type ON cross_conversation_connections(connection_type);
CREATE INDEX idx_cross_connections_strength ON cross_conversation_connections(connection_strength DESC);
CREATE INDEX idx_cross_connections_updated ON cross_conversation_connections(last_updated DESC);

-- Add constraint to prevent duplicate connections (order doesn't matter)
CREATE UNIQUE INDEX idx_cross_connections_unique ON cross_conversation_connections(
  user_id, 
  LEAST(person_a_id, person_b_id), 
  GREATEST(person_a_id, person_b_id)
);