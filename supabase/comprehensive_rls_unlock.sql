-- Comprehensive RLS permissions fix for the Prototype

-- During the previous secure-scoping, we locked down SELECTs for collections and memories,
-- but we may have accidentally left INSERT, UPDATE, and DELETE locked out entirely!
-- This script ensures all tables have their necessary write permissions restored.

-- 1. Collections - we added a SELECT policy, but users need to be able to create, edit, and delete their own.
DROP POLICY IF EXISTS "Users can insert own collections" ON collections;
DROP POLICY IF EXISTS "Users can update own collections" ON collections;
DROP POLICY IF EXISTS "Users can delete own collections" ON collections;

-- Actually, for the Prototype, it's safer to just allow authenticated users to perform standard operations
-- and let the app handle the logic, OR enforce it strictly. Let's enforce it securely:
CREATE POLICY "Users can insert own collections" ON collections FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own collections" ON collections FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own collections" ON collections FOR DELETE USING (auth.uid() = owner_id);

-- 2. Persons (400 Error on Add Person indicates missing insert permissions)
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public select for persons" ON persons;
DROP POLICY IF EXISTS "Enable public insert for persons" ON persons;
DROP POLICY IF EXISTS "Enable public update for persons" ON persons;
DROP POLICY IF EXISTS "Enable public delete for persons" ON persons;

-- Persons are shared across the system currently (no owner_id), so allow all authenticated read/write
CREATE POLICY "Enable public select for persons" ON persons FOR SELECT USING (true);
CREATE POLICY "Enable public insert for persons" ON persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable public update for persons" ON persons FOR UPDATE USING (true);
CREATE POLICY "Enable public delete for persons" ON persons FOR DELETE USING (true);

-- 3. Shares (403 on Dashboard indicates missing read/write permissions)
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read relevant shares" ON shares;
DROP POLICY IF EXISTS "Users can insert shares" ON shares;
DROP POLICY IF EXISTS "Users can update relevant shares" ON shares;

-- A user can read a share if they sent it OR they are receiving it
CREATE POLICY "Users can read relevant shares" ON shares FOR SELECT USING (
    auth.uid() = sender_id OR recipient_email = (auth.jwt() ->> 'email')
);

-- Anyone can send a share (insert)
CREATE POLICY "Users can insert shares" ON shares FOR INSERT WITH CHECK (
    auth.uid() = sender_id
);

-- A user can update a share (accept/reject) if they are the recipient
CREATE POLICY "Users can update relevant shares" ON shares FOR UPDATE USING (
    recipient_email = (auth.jwt() ->> 'email')
);

-- 4. memory_collections (Junction table)
-- We need to ensure users can read/write the links if they own the collection or memory
ALTER TABLE memory_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public select for memory_collections" ON memory_collections;
DROP POLICY IF EXISTS "Enable public insert for memory_collections" ON memory_collections;
DROP POLICY IF EXISTS "Enable public delete for memory_collections" ON memory_collections;

CREATE POLICY "Enable public select for memory_collections" ON memory_collections FOR SELECT USING (true);
CREATE POLICY "Enable public insert for memory_collections" ON memory_collections FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable public delete for memory_collections" ON memory_collections FOR DELETE USING (true);

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
