-- Fix RLS to prevent 'two copies' issue after accepting a share
-- Previously, recipients could access the original memory/collection indefinitely.

-- Fix Memories Table Policies
DROP POLICY IF EXISTS "Enable public select for memories" ON memories;
DROP POLICY IF EXISTS "Public Memories are viewable by everyone" ON memories;
DROP POLICY IF EXISTS "Users can only read their own memories" ON memories;
DROP POLICY IF EXISTS "Users can read own memories or shared memories" ON memories;

CREATE POLICY "Users can read own memories or shared memories" ON memories
    FOR SELECT USING (
        auth.uid() = uploader_id 
        OR 
        id IN (
            SELECT memory_id FROM shares WHERE recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND status = 'pending'
        )
        OR
        id IN (
            SELECT mc.memory_id FROM memory_collections mc 
            JOIN shares s ON mc.collection_id = s.collection_id
            WHERE s.recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND s.status = 'pending'
        )
    );

-- Fix Collections Table Policies
DROP POLICY IF EXISTS "Enable public select for collections" ON collections;
DROP POLICY IF EXISTS "Users can read own collections or shared collections" ON collections;

CREATE POLICY "Users can read own collections or shared collections" ON collections
    FOR SELECT USING (
        auth.uid() = owner_id 
        OR 
        id IN (
            SELECT collection_id FROM shares WHERE recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND status = 'pending'
        )
    );

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
