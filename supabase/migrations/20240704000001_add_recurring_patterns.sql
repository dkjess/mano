-- Create recurring_patterns table for learning system
CREATE TABLE recurring_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pattern_type text NOT NULL CHECK (pattern_type IN ('challenge', 'topic', 'relationship', 'communication')),
  pattern_description text NOT NULL,
  frequency integer DEFAULT 1,
  last_occurrence timestamptz DEFAULT now(),
  people_involved text[] DEFAULT '{}',
  context_keywords text[] DEFAULT '{}',
  suggested_actions text[] DEFAULT '{}',
  confidence_score real DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add RLS policies
ALTER TABLE recurring_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring patterns" ON recurring_patterns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring patterns" ON recurring_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring patterns" ON recurring_patterns
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring patterns" ON recurring_patterns
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_recurring_patterns_user_id ON recurring_patterns(user_id);
CREATE INDEX idx_recurring_patterns_type ON recurring_patterns(pattern_type);
CREATE INDEX idx_recurring_patterns_frequency ON recurring_patterns(frequency DESC);
CREATE INDEX idx_recurring_patterns_last_occurrence ON recurring_patterns(last_occurrence DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recurring_patterns_updated_at
  BEFORE UPDATE ON recurring_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();