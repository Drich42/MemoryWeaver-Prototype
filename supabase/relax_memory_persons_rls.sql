-- Fix RLS for Memory Persons

-- Ensure RLS is enabled
ALTER TABLE memory_persons ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies for memory_persons if any
DROP POLICY IF EXISTS "Enable public select for memory_persons" ON memory_persons;
DROP POLICY IF EXISTS "Enable public insert for memory_persons" ON memory_persons;
DROP POLICY IF EXISTS "Enable public update for memory_persons" ON memory_persons;
DROP POLICY IF EXISTS "Enable public delete for memory_persons" ON memory_persons;

-- Allow all authenticated users to read, insert, update, and delete memory_persons (Prototype-friendly)
CREATE POLICY "Enable public select for memory_persons" ON memory_persons FOR SELECT USING (true);
CREATE POLICY "Enable public insert for memory_persons" ON memory_persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable public update for memory_persons" ON memory_persons FOR UPDATE USING (true);
CREATE POLICY "Enable public delete for memory_persons" ON memory_persons FOR DELETE USING (true);
