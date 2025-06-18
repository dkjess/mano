-- Profile Completion Fields - Run this in Supabase SQL Editor
-- Adds rich profile fields to the people table for enhanced context

-- Add new columns to people table for richer profiles
ALTER TABLE people ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS team TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS communication_style TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS goals TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS strengths TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS challenges TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS last_profile_prompt TIMESTAMP WITH TIME ZONE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS profile_completion_score INTEGER DEFAULT 0;

-- Add helpful comments
COMMENT ON COLUMN people.notes IS 'General notes about the person and working relationship';
COMMENT ON COLUMN people.emoji IS 'Emoji representing the person''s personality or role';
COMMENT ON COLUMN people.team IS 'Team or department the person belongs to';
COMMENT ON COLUMN people.location IS 'Location or office where the person works';
COMMENT ON COLUMN people.start_date IS 'Date when the person started in their role';
COMMENT ON COLUMN people.communication_style IS 'Preferred communication style and methods';
COMMENT ON COLUMN people.goals IS 'Current goals, objectives, or development areas';
COMMENT ON COLUMN people.strengths IS 'Key strengths and skills';
COMMENT ON COLUMN people.challenges IS 'Growth areas or challenges to work on';
COMMENT ON COLUMN people.last_profile_prompt IS 'Timestamp of last profile completion prompt';
COMMENT ON COLUMN people.profile_completion_score IS 'Calculated score 0-100 for profile completeness';

-- Create index for profile completion queries
CREATE INDEX IF NOT EXISTS people_profile_completion_idx ON people (profile_completion_score, last_profile_prompt);
CREATE INDEX IF NOT EXISTS people_team_idx ON people (team) WHERE team IS NOT NULL;

-- Add constraint to ensure profile completion score is valid
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_profile_completion_score_check;
ALTER TABLE people ADD CONSTRAINT people_profile_completion_score_check 
  CHECK (profile_completion_score >= 0 AND profile_completion_score <= 100);

-- Create a function to calculate profile completion score
CREATE OR REPLACE FUNCTION calculate_profile_completion_score(person_record people)
RETURNS INTEGER AS $$
DECLARE
  total_possible INTEGER := 100;
  current_score INTEGER := 0;
BEGIN
  -- Role (20 points)
  IF person_record.role IS NOT NULL AND trim(person_record.role) != '' THEN
    current_score := current_score + 20;
  END IF;
  
  -- Notes (15 points)
  IF person_record.notes IS NOT NULL AND trim(person_record.notes) != '' THEN
    current_score := current_score + 15;
  END IF;
  
  -- Team (10 points)
  IF person_record.team IS NOT NULL AND trim(person_record.team) != '' THEN
    current_score := current_score + 10;
  END IF;
  
  -- Communication style (10 points)
  IF person_record.communication_style IS NOT NULL AND trim(person_record.communication_style) != '' THEN
    current_score := current_score + 10;
  END IF;
  
  -- Goals (10 points)
  IF person_record.goals IS NOT NULL AND trim(person_record.goals) != '' THEN
    current_score := current_score + 10;
  END IF;
  
  -- Strengths (10 points)
  IF person_record.strengths IS NOT NULL AND trim(person_record.strengths) != '' THEN
    current_score := current_score + 10;
  END IF;
  
  -- Challenges (10 points)
  IF person_record.challenges IS NOT NULL AND trim(person_record.challenges) != '' THEN
    current_score := current_score + 10;
  END IF;
  
  -- Emoji (5 points)
  IF person_record.emoji IS NOT NULL AND trim(person_record.emoji) != '' THEN
    current_score := current_score + 5;
  END IF;
  
  -- Location (5 points)
  IF person_record.location IS NOT NULL AND trim(person_record.location) != '' THEN
    current_score := current_score + 5;
  END IF;
  
  -- Start date (5 points)
  IF person_record.start_date IS NOT NULL THEN
    current_score := current_score + 5;
  END IF;
  
  RETURN current_score;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update profile completion score
CREATE OR REPLACE FUNCTION update_profile_completion_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_completion_score := calculate_profile_completion_score(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS people_profile_completion_trigger ON people;

-- Create trigger for automatic score updates
CREATE TRIGGER people_profile_completion_trigger
  BEFORE INSERT OR UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_completion_score();

-- Update existing records to calculate their completion scores
UPDATE people SET profile_completion_score = calculate_profile_completion_score(people.*);

-- Add helpful view for profile analytics
CREATE OR REPLACE VIEW people_profile_analytics AS
SELECT 
  user_id,
  COUNT(*) as total_people,
  ROUND(AVG(profile_completion_score), 2) as avg_completion_score,
  COUNT(CASE WHEN profile_completion_score >= 80 THEN 1 END) as complete_profiles,
  COUNT(CASE WHEN profile_completion_score < 50 THEN 1 END) as incomplete_profiles,
  COUNT(CASE WHEN last_profile_prompt IS NOT NULL THEN 1 END) as profiles_prompted
FROM people
GROUP BY user_id;

-- Grant access to the view
GRANT SELECT ON people_profile_analytics TO authenticated;

-- Enable RLS on the view (inherits from base table)
ALTER VIEW people_profile_analytics SET (security_barrier = true); 