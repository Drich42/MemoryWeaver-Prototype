-- Secure `persons` and `person_relationships` tables to prevent cross-account leakage
-- The prototype previously set these to globally readable/writable.

-- 1. Add owner_id to persons (if not exists)
ALTER TABLE persons ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- Default existing persons to the user running the query (safe fallback for prototype)
UPDATE persons SET owner_id = auth.uid() WHERE owner_id IS NULL;

-- 2. Restrict persons RLS
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public select for persons" ON persons;
DROP POLICY IF EXISTS "Enable public insert for persons" ON persons;
DROP POLICY IF EXISTS "Enable public update for persons" ON persons;
DROP POLICY IF EXISTS "Enable public delete for persons" ON persons;

CREATE POLICY "Users can select own persons" ON persons FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own persons" ON persons FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own persons" ON persons FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own persons" ON persons FOR DELETE USING (auth.uid() = owner_id);


-- 3. Add owner_id to person_relationships
ALTER TABLE person_relationships ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- Default existing relationships to the user running the query
UPDATE person_relationships SET owner_id = auth.uid() WHERE owner_id IS NULL;

-- 4. Restrict person_relationships RLS
ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public select" ON person_relationships;
DROP POLICY IF EXISTS "Enable public insert" ON person_relationships;
DROP POLICY IF EXISTS "Enable public update" ON person_relationships;
DROP POLICY IF EXISTS "Enable public delete" ON person_relationships;

CREATE POLICY "Users can select own relationships" ON person_relationships FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own relationships" ON person_relationships FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own relationships" ON person_relationships FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own relationships" ON person_relationships FOR DELETE USING (auth.uid() = owner_id);

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
