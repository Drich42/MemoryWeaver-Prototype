-- NUCLEAR DATABANK WIPE
-- This script safely deletes all operational data in the MemoryLoom database
-- while preserving the actual tables, relationships, and structure.

-- WARNING: THIS DELETES ALL MEMORIES, PEOPLE, COLLECTIONS, AND SHARES PERMANENTLY.

-- We use TRUNCATE instead of DELETE for speed, and CASCADE to automatically wipe 
-- all the junction tables (memory_persons, memory_collections, etc.) that depend on these rows.

TRUNCATE TABLE 
    memories,
    persons,
    collections,
    events,
    places,
    entities,
    shares
CASCADE;

-- Note: The CASCADE keyword automatically truncates the following dependent tables:
-- memory_persons
-- memory_places
-- memory_events
-- memory_entities
-- memory_collections
-- memory_trust_groups
-- person_relationships
