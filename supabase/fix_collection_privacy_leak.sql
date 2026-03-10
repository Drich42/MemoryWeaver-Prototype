-- Patch: Removing outdated Public RLS Policies for Collections
-- The original collections_rls.sql included these overly permissive policies:

-- CREATE POLICY "Enable public insert for collections" ON collections FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Enable public select for collections" ON collections FOR SELECT USING (true);
-- ...etc

-- Because Postgres RLS policies evaluate with an OR logical operator, a permissive policy 
-- will override our strict `auth.uid() = user_id` policies in multi_user_rls.sql. We must drop them.

DROP POLICY IF EXISTS "Enable public insert for collections" ON collections;
DROP POLICY IF EXISTS "Enable public select for collections" ON collections;
DROP POLICY IF EXISTS "Enable public update for collections" ON collections;
DROP POLICY IF EXISTS "Enable public delete for collections" ON collections;

DROP POLICY IF EXISTS "Enable public insert for memory_collections" ON memory_collections;
DROP POLICY IF EXISTS "Enable public select for memory_collections" ON memory_collections;
DROP POLICY IF EXISTS "Enable public update for memory_collections" ON memory_collections;
DROP POLICY IF EXISTS "Enable public delete for memory_collections" ON memory_collections;

-- Force the schema cache to reload so the API picks up the dropped policies instantly
NOTIFY pgrst, 'reload schema';
