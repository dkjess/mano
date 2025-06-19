BEGIN;

-- Create topics table
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  participants JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_topics_created_by ON topics(created_by);
CREATE INDEX idx_topics_status ON topics(status);
CREATE INDEX idx_topics_updated_at ON topics(updated_at DESC);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_topics_updated_at 
  BEFORE UPDATE ON topics 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

COMMIT; 