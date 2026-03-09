-- Migration: Upgrading Memory Weaver to Multi-User Architecture with RLS

-- 1. Wipe existing orphaned demo data to resolve constraint locks
TRUNCATE TABLE memories, persons, places, events, entities, collections, trust_groups, person_relationships CASCADE;

-- 2. Add User Ownership Column to all root tables
ALTER TABLE trust_groups ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL;

-- Fix memories to use unified user_id string instead of 'uploader_id'
ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL;
-- (Assuming we drop uploader_id if it existed previously)

-- 3. Enable RLS on all tables
ALTER TABLE trust_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Junction Tables RLS
ALTER TABLE memory_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_trust_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for Root Tables (Users only see/edit their own rows)
CREATE POLICY "Users can manage their own trust_groups" ON trust_groups FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own persons" ON persons FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own places" ON places FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own events" ON events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own entities" ON entities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own collections" ON collections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own memories" ON memories FOR ALL USING (auth.uid() = user_id);

-- 5. Create RLS Policies for Junction Tables
-- For junction tables, we verify the user owns the child record (e.g. they own the memory that is being linked)
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

-- For person_relationships, check that the user owns Person A
CREATE POLICY "Users can manage their own graph edges" ON person_relationships FOR ALL
USING (EXISTS (SELECT 1 FROM persons WHERE persons.id = person_relationships.person_a_id AND persons.user_id = auth.uid()));
