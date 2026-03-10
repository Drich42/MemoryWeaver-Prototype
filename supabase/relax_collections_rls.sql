-- Fix RLS for Collection Sharing

-- Drop existing restrictive policies for collections
DROP POLICY IF EXISTS "Enable public select for collections" ON collections;

-- Allow all authenticated users to read collections (Prototype-friendly)
CREATE POLICY "Enable public select for collections" ON collections
    FOR SELECT USING (true);


-- Drop existing restrictive policies for memory_collections
DROP POLICY IF EXISTS "Enable public select for memory_collections" ON memory_collections;

-- Allow all authenticated users to read memory_collections (Prototype-friendly)
CREATE POLICY "Enable public select for memory_collections" ON memory_collections
    FOR SELECT USING (true);

-- Ensure users can insert into memory_collections during the deep copy
DROP POLICY IF EXISTS "Enable public insert for memory_collections" ON memory_collections;
CREATE POLICY "Enable public insert for memory_collections" ON memory_collections
    FOR INSERT WITH CHECK (true);
