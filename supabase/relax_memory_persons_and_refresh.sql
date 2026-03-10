-- Ultimate RLS Fix for Prototype Sharing

-- 1. Relax memory_persons so bio tags can be inserted
ALTER TABLE memory_persons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public select for memory_persons" ON memory_persons;
DROP POLICY IF EXISTS "Enable public insert for memory_persons" ON memory_persons;
DROP POLICY IF EXISTS "Enable public update for memory_persons" ON memory_persons;
DROP POLICY IF EXISTS "Enable public delete for memory_persons" ON memory_persons;

CREATE POLICY "Enable public select for memory_persons" ON memory_persons FOR SELECT USING (true);
CREATE POLICY "Enable public insert for memory_persons" ON memory_persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable public update for memory_persons" ON memory_persons FOR UPDATE USING (true);
CREATE POLICY "Enable public delete for memory_persons" ON memory_persons FOR DELETE USING (true);

-- 2. Force the cache reload immediately so it takes effect right away!
NOTIFY pgrst, 'reload schema';
