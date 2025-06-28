-- Delete duplicate General topics, keeping only the oldest one per user
DELETE FROM topics 
WHERE id NOT IN (
  SELECT DISTINCT ON (created_by) id
  FROM topics 
  WHERE title = 'General'
  ORDER BY created_by, created_at ASC
) AND title = 'General';

-- Show remaining General topics
SELECT created_by, COUNT(*) as topic_count, MIN(created_at) as earliest_created
FROM topics 
WHERE title = 'General' 
GROUP BY created_by
ORDER BY created_by;