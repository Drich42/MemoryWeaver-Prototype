-- Grant Read Access to Pending and Accepted Shares

-- 1. Redefine the SECURITY DEFINER function for memories to allow 'pending' and 'accepted'
CREATE OR REPLACE FUNCTION user_has_memory_share_access(mem_id UUID, user_uid UUID) 
RETURNS BOOLEAN
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Get user email safely
    SELECT email INTO user_email FROM auth.users WHERE id = user_uid;
    
    -- Check direct memory share (PENDING or ACCEPTED)
    IF EXISTS (SELECT 1 FROM shares WHERE memory_id = mem_id AND recipient_email = user_email AND status IN ('pending', 'accepted')) THEN
        RETURN TRUE;
    END IF;

    -- Check collection share (PENDING or ACCEPTED)
    IF EXISTS (
        SELECT 1 
        FROM memory_collections mc
        JOIN shares s ON s.collection_id = mc.collection_id
        WHERE mc.memory_id = mem_id AND s.recipient_email = user_email AND s.status IN ('pending', 'accepted')
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 2. Create a SECURITY DEFINER function for collections to allow 'pending' and 'accepted'
CREATE OR REPLACE FUNCTION user_has_collection_share_access(col_id UUID, user_uid UUID) 
RETURNS BOOLEAN
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = user_uid;
    
    -- Check collection share (PENDING or ACCEPTED)
    IF EXISTS (SELECT 1 FROM shares WHERE collection_id = col_id AND recipient_email = user_email AND status IN ('pending', 'accepted')) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 3. We also need to ensure that memory_collections can be read if the user has access to the collection OR the memory.
-- Currently, memory_collections might not have an RLS policy that explicitly allows this using our new functions.
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON memory_collections;
DROP POLICY IF EXISTS "Users can read own memory_collections or shared" ON memory_collections;

CREATE POLICY "Users can read own memory_collections or shared" ON memory_collections
    FOR SELECT USING (
        -- Can read if they own the collection
        EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_id AND c.owner_id = auth.uid()) OR
        -- Can read if they own the memory
        EXISTS (SELECT 1 FROM memories m WHERE m.id = memory_id AND m.uploader_id = auth.uid()) OR
        -- Can read if they have share access to the collection
        user_has_collection_share_access(collection_id, auth.uid()) OR
        -- Can read if they have share access to the memory
        user_has_memory_share_access(memory_id, auth.uid())
    );

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
