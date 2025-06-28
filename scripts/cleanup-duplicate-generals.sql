-- Clean up duplicate General topics, keeping only the oldest one per user
WITH ranked_topics AS (
  SELECT 
    id,
    created_by,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY created_by 
      ORDER BY created_at ASC
    ) as rn
  FROM topics 
  WHERE title = 'General'
),
topics_to_delete AS (
  SELECT id 
  FROM ranked_topics 
  WHERE rn > 1
)
-- First update any messages pointing to topics we're about to delete
-- Point them to the earliest General topic for that user
UPDATE messages 
SET topic_id = (
  SELECT t1.id 
  FROM topics t1 
  WHERE t1.title = 'General' 
  AND t1.created_by = (
    SELECT t2.created_by 
    FROM topics t2 
    WHERE t2.id = messages.topic_id
  )
  ORDER BY t1.created_at ASC 
  LIMIT 1
)
WHERE topic_id IN (SELECT id FROM topics_to_delete);

-- Now delete the duplicate topics
DELETE FROM topics 
WHERE id IN (SELECT id FROM topics_to_delete);

-- Show remaining General topics
SELECT created_by, COUNT(*) as topic_count, MIN(created_at) as earliest_created
FROM topics 
WHERE title = 'General' 
GROUP BY created_by
ORDER BY created_by;