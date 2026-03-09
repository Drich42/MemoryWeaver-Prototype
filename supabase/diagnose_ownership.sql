-- Diagnostic Script: Check Row Ownership Data
-- This checks if the data being inserted actually has distinct user_ids

-- View how many distinct users currently own persons
SELECT user_id, count(*) as person_count
FROM persons
GROUP BY user_id;

-- View how many distinct users currently own memories
SELECT user_id, count(*) as memory_count
FROM memories
GROUP BY user_id;

-- Print the 5 most recent persons to see what user_id they got
SELECT id, display_name, user_id, created_at 
FROM persons 
ORDER BY created_at DESC 
LIMIT 5;
