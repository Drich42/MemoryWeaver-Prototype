-- Add Support for Collection Sharing

-- 1. Alter `shares` table to accept a collection_id instead of just a memory_id
ALTER TABLE shares 
ADD COLUMN collection_id UUID REFERENCES collections(id) ON DELETE CASCADE;

-- 2. Make memory_id nullable since a share could just be a collection
ALTER TABLE shares
ALTER COLUMN memory_id DROP NOT NULL;

-- 3. Add a check constraint to ensure that a share has EITHER a memory_id OR a collection_id, but not both or neither.
ALTER TABLE shares
ADD CONSTRAINT check_share_target 
CHECK (
  (memory_id IS NOT NULL AND collection_id IS NULL) OR 
  (memory_id IS NULL AND collection_id IS NOT NULL)
);
