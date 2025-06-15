-- Migrate existing "general" messages to use "1-1" person_id
-- This script can be run to update any existing data from the old naming convention

UPDATE messages 
SET person_id = '1-1' 
WHERE person_id = 'general';

-- Verify the migration
-- SELECT COUNT(*) as old_general_count FROM messages WHERE person_id = 'general';
-- SELECT COUNT(*) as new_1_1_count FROM messages WHERE person_id = '1-1'; 