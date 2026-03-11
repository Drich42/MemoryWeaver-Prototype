-- Fix Infinite Recursion AND Limit Access to Pending Shares ONLY

-- 1. Redefine the SECURITY DEFINER function for memories to only return true if status = 'pending'
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
    
    -- Check direct memory share (PENDING ONLY)
    IF EXISTS (SELECT 1 FROM shares WHERE memory_id = mem_id AND recipient_email = user_email AND status = 'pending') THEN
        RETURN TRUE;
    END IF;

    -- Check collection share (PENDING ONLY)
    IF EXISTS (
        SELECT 1 
        FROM memory_collections mc
        JOIN shares s ON s.collection_id = mc.collection_id
        WHERE mc.memory_id = mem_id AND s.recipient_email = user_email AND s.status = 'pending'
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 2. Restore the safely-encapsulated policy for memories
DROP POLICY IF EXISTS "Users can read own memories or shared memories" ON memories;

CREATE POLICY "Users can read own memories or shared memories" ON memories
    FOR SELECT USING (
        auth.uid() = uploader_id 
        OR 
        user_has_memory_share_access(id, auth.uid())
    );

-- 3. Create a SECURITY DEFINER function for collections to prevent similar loops
CREATE OR REPLACE FUNCTION user_has_collection_share_access(col_id UUID, user_uid UUID) 
RETURNS BOOLEAN
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = user_uid;
    
    -- Check collection share (PENDING ONLY)
    IF EXISTS (SELECT 1 FROM shares WHERE collection_id = col_id AND recipient_email = user_email AND status = 'pending') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply safely-encapsulated policy to collections
DROP POLICY IF EXISTS "Users can read own collections or shared collections" ON collections;

CREATE POLICY "Users can read own collections or shared collections" ON collections
    FOR SELECT USING (
        auth.uid() = owner_id 
        OR 
        user_has_collection_share_access(id, auth.uid())
    );

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
