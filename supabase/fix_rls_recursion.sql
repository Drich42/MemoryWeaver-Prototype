-- Fix Infinite Recursion in Memories RLS Policy

-- The previous policy caused infinite recursion because it queried `memory_collections`
-- to check if a memory was part of a shared collection, but `memory_collections` 
-- might have its own RLS policies that query `collections` or `memories`, causing a loop.

-- 1. Drop the recursive policy from memories
DROP POLICY IF EXISTS "Users can read own memories or shared memories" ON memories;

-- 2. Create a clean, non-recursive policy for memories
-- To avoid recursion, we should only query the `shares` table directly if it points to the memory_id.
-- If we need to support granting access to memories via a shared collection, we should temporarily 
-- offload that logic to a SECURITY DEFINER function, OR simply rely on the fact that during the
-- ShareReview mapping, we temporarily bypassed RLS anyway. Actually, we didn't, we fixed memory_persons. 

-- Let's use a very safe, direct policy:
CREATE POLICY "Users can read own memories or shared memories" ON memories
    FOR SELECT USING (
        -- You own it
        auth.uid() = uploader_id 
        OR 
        -- It is shared directly with you as a single memory
        id IN (
            SELECT memory_id FROM shares WHERE recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
        OR
        -- It is part of a collection that is shared directly with you
        (
            -- We must be careful not to trigger memories RLS again. 
            -- Querying memory_collections is safe IF memory_collections doesn't query memories.
            -- Querying collections is safe IF collections doesn't query memories.
            -- Let's try this carefully:
            id IN (
                SELECT mc.memory_id 
                FROM memory_collections mc
                JOIN shares s ON s.collection_id = mc.collection_id
                WHERE s.recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
            )
        )
    );

-- Wait, the recursion error is literally that. When we select from memory_collections, Postgres applies RLS to memory_collections.
-- If memory_collections RLS checks "can I see the memory?", then it queries memories... loop!

-- Let's check memory_collections RLS. 
-- For now, the safest and absolute best fix for Prototype sharing is to decouple the policy
-- by creating a SECURITY DEFINER function that checks share access without triggering RLS.

---------------------------------------------------------
-- THE BULLETPROOF FIX: SECURITY DEFINER FUNCTION
---------------------------------------------------------

-- Create a function that runs as DB owner to check if a user has access via a share
CREATE OR REPLACE FUNCTION user_has_memory_share_access(mem_id UUID, user_uid UUID) 
RETURNS BOOLEAN
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
    has_access BOOLEAN;
BEGIN
    -- Get user email
    SELECT email INTO user_email FROM auth.users WHERE id = user_uid;
    
    -- Check direct memory share
    IF EXISTS (SELECT 1 FROM shares WHERE memory_id = mem_id AND recipient_email = user_email) THEN
        RETURN TRUE;
    END IF;

    -- Check collection share
    IF EXISTS (
        SELECT 1 
        FROM memory_collections mc
        JOIN shares s ON s.collection_id = mc.collection_id
        WHERE mc.memory_id = mem_id AND s.recipient_email = user_email
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Now replace the policy to use the function:
DROP POLICY IF EXISTS "Users can read own memories or shared memories" ON memories;

CREATE POLICY "Users can read own memories or shared memories" ON memories
    FOR SELECT USING (
        auth.uid() = uploader_id 
        OR 
        user_has_memory_share_access(id, auth.uid())
    );

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
