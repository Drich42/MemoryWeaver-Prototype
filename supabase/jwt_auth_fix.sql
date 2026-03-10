-- Fix Permissions Error on auth.users query

-- The previous policies tried to run a standard SQL SELECT against the internal Supabase 
-- `auth.users` table. The web user (role 'authenticated') doesn't actually have 
-- permission to read that table!
-- Instead, we should extract the email directly from the user's active login token (JWT).

-- 1. Fix Collections Policy
DROP POLICY IF EXISTS "Users can read own collections or shared collections" ON collections;
CREATE POLICY "Users can read own collections or shared collections" ON collections
    FOR SELECT USING (
        auth.uid() = owner_id 
        OR 
        id IN (
            SELECT collection_id FROM shares WHERE recipient_email = (auth.jwt() ->> 'email')
        )
    );

-- 2. Update the Memory Share Security Definer Function to use JWT inside the policy,
-- or simply change the function signature if we still use it.
-- Actually, we can just revert back to the clean query and use the JWT! 
-- But keeping the Security Definer is still absolutely better for avoiding recursion. 

CREATE OR REPLACE FUNCTION user_has_memory_share_access(mem_id UUID, user_uid UUID, user_email TEXT) 
RETURNS BOOLEAN
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
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

-- 3. Replace the Memories policy to pass the JWT email directly into the function
DROP POLICY IF EXISTS "Users can read own memories or shared memories" ON memories;
CREATE POLICY "Users can read own memories or shared memories" ON memories
    FOR SELECT USING (
        auth.uid() = uploader_id 
        OR 
        user_has_memory_share_access(id, auth.uid(), auth.jwt() ->> 'email')
    );

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
