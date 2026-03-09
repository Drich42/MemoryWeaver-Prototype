-- 1. Add "known_as" alias for users
ALTER TABLE persons ADD COLUMN known_as TEXT;

-- 2. Add RLS policies for person_relationships edge table
ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable public insert" ON person_relationships FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable public select" ON person_relationships FOR SELECT USING (true);
CREATE POLICY "Enable public update" ON person_relationships FOR UPDATE USING (true);
CREATE POLICY "Enable public delete" ON person_relationships FOR DELETE USING (true);
