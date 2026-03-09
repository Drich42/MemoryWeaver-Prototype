-- Script: Drop Identified RLS Leaks
-- These exact policies were found to be granting open public access

-- Memories Leaks
DROP POLICY IF EXISTS "Enable public delete" ON memories;
DROP POLICY IF EXISTS "Enable public delete for memories" ON memories;
DROP POLICY IF EXISTS "Enable public insert" ON memories;
DROP POLICY IF EXISTS "Enable public insert for memories" ON memories;
DROP POLICY IF EXISTS "Enable public select" ON memories;
DROP POLICY IF EXISTS "Enable public update" ON memories;
DROP POLICY IF EXISTS "Enable public update for memories" ON memories;

-- Memory_Persons Leaks
DROP POLICY IF EXISTS "Enable public delete" ON memory_persons;
DROP POLICY IF EXISTS "Enable public insert" ON memory_persons;
DROP POLICY IF EXISTS "Enable public select" ON memory_persons;
DROP POLICY IF EXISTS "Enable public update" ON memory_persons;

-- Persons Leaks
DROP POLICY IF EXISTS "Enable public delete" ON persons;
DROP POLICY IF EXISTS "Enable public insert" ON persons;
DROP POLICY IF EXISTS "Enable public select" ON persons;
DROP POLICY IF EXISTS "Enable public update" ON persons;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
