-- Patch: Removing outdated Public RLS Policies

-- The original schema included these overly permissive policies:
-- CREATE POLICY "Public Memories are viewable by everyone" ON memories FOR SELECT USING (status = 'published');
-- CREATE POLICY "Enable public insert" ON person_relationships FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Enable public select" ON person_relationships FOR SELECT USING (true);
-- CREATE POLICY "Enable public update" ON person_relationships FOR UPDATE USING (true);
-- CREATE POLICY "Enable public delete" ON person_relationships FOR DELETE USING (true);

-- Because Postgres RLS policies are additive (OR logic), a permissive policy anywhere 
-- will override our strict `user_id = auth.uid()` policies. We must drop them.

DROP POLICY IF EXISTS "Public Memories are viewable by everyone" ON memories;
DROP POLICY IF EXISTS "Enable public insert" ON person_relationships;
DROP POLICY IF EXISTS "Enable public select" ON person_relationships;
DROP POLICY IF EXISTS "Enable public update" ON person_relationships;
DROP POLICY IF EXISTS "Enable public delete" ON person_relationships;

-- Force the schema cache to reload so the API picks up the dropped policies instantly
NOTIFY pgrst, 'reload schema';
