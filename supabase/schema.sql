-- MemoryLoom 7-Node SQL Schema for Supabase

-- 1. Trust Groups (Governance Node)
CREATE TABLE trust_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Persons (Actor Node)
CREATE TABLE persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    known_as TEXT,
    birth_date DATE,
    death_date DATE,
    biography TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Places (Geographic Node)
CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    coordinates POINT,
    address TEXT,
    type TEXT, -- city, base, address, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Events (Temporal Node)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Entities (Semantic Node / Tag / Object)
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- medal, unit, object, concept
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Collections (Context Node)
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Memories (Hub Node)
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    type TEXT NOT NULL, -- image, document, video, audio
    capture_date DATE,
    description TEXT,
    status TEXT DEFAULT 'draft',
    artifact_url TEXT,
    thumbnail_url TEXT,
    uploader_id UUID REFERENCES auth.users(id),
    status_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction Tables (Edges)

-- Memory to Person
CREATE TABLE memory_persons (
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
    role TEXT, -- subject, mentioned, author
    PRIMARY KEY (memory_id, person_id)
);

-- Memory to Place
CREATE TABLE memory_places (
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(id) ON DELETE CASCADE,
    PRIMARY KEY (memory_id, place_id)
);

-- Memory to Event
CREATE TABLE memory_events (
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    PRIMARY KEY (memory_id, event_id)
);

-- Memory to Entity
CREATE TABLE memory_entities (
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    PRIMARY KEY (memory_id, entity_id)
);

-- Memory to Collection
CREATE TABLE memory_collections (
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    PRIMARY KEY (memory_id, collection_id)
);

-- Memory Visibility (Trust Group)
CREATE TABLE memory_trust_groups (
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    trust_group_id UUID REFERENCES trust_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (memory_id, trust_group_id)
);

-- Person to Person relationships (Graph connections)
CREATE TABLE person_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_a_id UUID REFERENCES persons(id) ON DELETE CASCADE,
    person_b_id UUID REFERENCES persons(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- spouse, parent, child, served_with
    start_date DATE,
    end_date DATE,
    UNIQUE (person_a_id, person_b_id, relationship_type)
);

-- Setup RLS (Row Level Security) basics - placeholder for now
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Memories are viewable by everyone" ON memories
    FOR SELECT USING (status = 'published');

-- Enable RLS for person_relationships
ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable public insert" ON person_relationships FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable public select" ON person_relationships FOR SELECT USING (true);
CREATE POLICY "Enable public update" ON person_relationships FOR UPDATE USING (true);
CREATE POLICY "Enable public delete" ON person_relationships FOR DELETE USING (true);
