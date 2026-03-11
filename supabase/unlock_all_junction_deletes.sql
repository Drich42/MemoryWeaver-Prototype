-- Comprehensive Cascade Delete Unlocker
-- If any junction table lacks a DELETE policy, deleting a memory or collection will fail.
-- This script ensures all junction tables allow deletes.

-- memory_places
ALTER TABLE memory_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public delete for memory_places" ON memory_places;
CREATE POLICY "Enable public delete for memory_places" ON memory_places FOR DELETE USING (true);

-- memory_events
ALTER TABLE memory_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public delete for memory_events" ON memory_events;
CREATE POLICY "Enable public delete for memory_events" ON memory_events FOR DELETE USING (true);

-- memory_entities
ALTER TABLE memory_entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public delete for memory_entities" ON memory_entities;
CREATE POLICY "Enable public delete for memory_entities" ON memory_entities FOR DELETE USING (true);

-- memory_trust_groups
ALTER TABLE memory_trust_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public delete for memory_trust_groups" ON memory_trust_groups;
CREATE POLICY "Enable public delete for memory_trust_groups" ON memory_trust_groups FOR DELETE USING (true);

-- Just to be absolutely sure about memory_collections (junction between memories and collections)
ALTER TABLE memory_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable public delete for memory_collections" ON memory_collections;
CREATE POLICY "Enable public delete for memory_collections" ON memory_collections FOR DELETE USING (true);

NOTIFY pgrst, 'reload schema';
