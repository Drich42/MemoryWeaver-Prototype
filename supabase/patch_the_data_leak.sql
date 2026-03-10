-- Tighten RLS for Memories and Collections to stop cross-account leakage

-- 1. Fix Memories Table
DROP POLICY IF EXISTS "Enable public select for memories" ON memories;
DROP POLICY IF EXISTS "Public Memories are viewable by everyone" ON memories;

-- Allow users to only see memories they own
CREATE POLICY "Users can only read their own memories" ON memories
    FOR SELECT USING (auth.uid() = uploader_id);

-- Wait, ShareReview needs to see the memory BEFORE they accept it.
-- Let's amend the policy so you can see a memory IF you own it, 
-- OR if there is an active share record aiming at your email.
DROP POLICY IF EXISTS "Users can only read their own memories" ON memories;

CREATE POLICY "Users can read own memories or shared memories" ON memories
    FOR SELECT USING (
        auth.uid() = uploader_id 
        OR 
        id IN (
            SELECT memory_id FROM shares WHERE recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
        OR
        id IN (
            SELECT mc.memory_id FROM memory_collections mc 
            JOIN shares s ON mc.collection_id = s.collection_id
            WHERE s.recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );


-- 2. Fix Collections Table (it doesn't have an owner ID yet!)
-- We need to add an owner to collections to scope them properly
ALTER TABLE collections ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- Now update existing collections to belong to whoever created them (just a safe default for prototype)
UPDATE collections SET owner_id = auth.uid() WHERE owner_id IS NULL;

-- Now apply the RLS to Collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public select for collections" ON collections;

CREATE POLICY "Users can read own collections or shared collections" ON collections
    FOR SELECT USING (
        auth.uid() = owner_id 
        OR 
        id IN (
            SELECT collection_id FROM shares WHERE recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
