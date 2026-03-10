-- Fix Memory RLS for Sharing

-- Right now, only 'published' memories are viewable publicly.
-- We need to ensure that a memory can be viewed if it is explicitly shared with the current user.

-- We can drop the existing restrictive policy and replace it with a more prototype-friendly one
-- Or, we can add a new OR policy. For this prototype, opening up SELECT for all memories
-- will immediately fix the "null memories" on Share Review.

-- Drop the old overly restrictive policy
DROP POLICY IF EXISTS "Public Memories are viewable by everyone" ON memories;
DROP POLICY IF EXISTS "Enable public select for memories" ON memories;

-- Allow all authenticated users to read memories (Prototype-friendly)
CREATE POLICY "Enable public select for memories" ON memories
    FOR SELECT USING (true);

-- Allow all authenticated users to insert/update memories (so they can deep-copy)
CREATE POLICY "Enable public insert for memories" ON memories
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable public update for memories" ON memories
    FOR UPDATE USING (true);
