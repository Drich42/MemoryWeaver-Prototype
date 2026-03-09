-- Script: Explicit Memory Weaver RLS Enforcement

-- 1. Drop ALL potentially leaking default policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Enable read access for all users" ON trust_groups;
    DROP POLICY IF EXISTS "Enable read access for all users" ON persons;
    DROP POLICY IF EXISTS "Enable read access for all users" ON places;
    DROP POLICY IF EXISTS "Enable read access for all users" ON events;
    DROP POLICY IF EXISTS "Enable read access for all users" ON entities;
    DROP POLICY IF EXISTS "Enable read access for all users" ON collections;
    DROP POLICY IF EXISTS "Enable read access for all users" ON memories;
    DROP POLICY IF EXISTS "Enable read access for all users" ON memory_persons;
    DROP POLICY IF EXISTS "Enable read access for all users" ON memory_places;
    DROP POLICY IF EXISTS "Enable read access for all users" ON memory_events;
    DROP POLICY IF EXISTS "Enable read access for all users" ON memory_entities;
    DROP POLICY IF EXISTS "Enable read access for all users" ON memory_collections;
    DROP POLICY IF EXISTS "Enable read access for all users" ON memory_trust_groups;
    DROP POLICY IF EXISTS "Enable read access for all users" ON person_relationships;

    DROP POLICY IF EXISTS "Enable insert access for all users" ON person_relationships;
    DROP POLICY IF EXISTS "Enable update access for all users" ON person_relationships;
    DROP POLICY IF EXISTS "Enable delete access for all users" ON person_relationships;

-- 2. Explicitly drop the secure policies we are about to create to avoid "already exists" errors
    DROP POLICY IF EXISTS "Users can manage their own trust_groups" ON trust_groups;
    DROP POLICY IF EXISTS "Users can manage their own persons" ON persons;
    DROP POLICY IF EXISTS "Users can manage their own places" ON places;
    DROP POLICY IF EXISTS "Users can manage their own events" ON events;
    DROP POLICY IF EXISTS "Users can manage their own entities" ON entities;
    DROP POLICY IF EXISTS "Users can manage their own collections" ON collections;
    DROP POLICY IF EXISTS "Users can manage their own memories" ON memories;
    DROP POLICY IF EXISTS "Users can manage memory_persons links they own" ON memory_persons;
    DROP POLICY IF EXISTS "Users can manage memory_places links they own" ON memory_places;
    DROP POLICY IF EXISTS "Users can manage memory_events links they own" ON memory_events;
    DROP POLICY IF EXISTS "Users can manage memory_entities links they own" ON memory_entities;
    DROP POLICY IF EXISTS "Users can manage memory_collections links they own" ON memory_collections;
    DROP POLICY IF EXISTS "Users can manage memory_trust_groups links they own" ON memory_trust_groups;
    DROP POLICY IF EXISTS "Users can manage their own graph edges" ON person_relationships;

EXCEPTION WHEN others THEN
    -- Ignore dropping errors
END $$;

-- 3. Ensure RLS is enabled on all tables
ALTER TABLE trust_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_trust_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;

-- 4. Recreate the precise secure policies
CREATE POLICY "Users can manage their own trust_groups" ON trust_groups FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own persons" ON persons FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own places" ON places FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own events" ON events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own entities" ON entities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own collections" ON collections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own memories" ON memories FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage memory_persons links they own" ON memory_persons FOR ALL 
USING (EXISTS (SELECT 1 FROM memories WHERE memories.id = memory_persons.memory_id AND memories.user_id = auth.uid()));

CREATE POLICY "Users can manage memory_places links they own" ON memory_places FOR ALL 
USING (EXISTS (SELECT 1 FROM memories WHERE memories.id = memory_places.memory_id AND memories.user_id = auth.uid()));

CREATE POLICY "Users can manage memory_events links they own" ON memory_events FOR ALL 
USING (EXISTS (SELECT 1 FROM memories WHERE memories.id = memory_events.memory_id AND memories.user_id = auth.uid()));

CREATE POLICY "Users can manage memory_entities links they own" ON memory_entities FOR ALL 
USING (EXISTS (SELECT 1 FROM memories WHERE memories.id = memory_entities.memory_id AND memories.user_id = auth.uid()));

CREATE POLICY "Users can manage memory_collections links they own" ON memory_collections FOR ALL 
USING (EXISTS (SELECT 1 FROM memories WHERE memories.id = memory_collections.memory_id AND memories.user_id = auth.uid()));

CREATE POLICY "Users can manage memory_trust_groups links they own" ON memory_trust_groups FOR ALL 
USING (EXISTS (SELECT 1 FROM memories WHERE memories.id = memory_trust_groups.memory_id AND memories.user_id = auth.uid()));

CREATE POLICY "Users can manage their own graph edges" ON person_relationships FOR ALL
USING (EXISTS (SELECT 1 FROM persons WHERE persons.id = person_relationships.person_a_id AND persons.user_id = auth.uid()));

-- 5. Reload PostgREST Cache immediately
NOTIFY pgrst, 'reload schema';
