-- Add Provenance Tracking to Memories

ALTER TABLE memories 
ADD COLUMN IF NOT EXISTS imported_from_share_id UUID REFERENCES shares(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS original_memory_id UUID REFERENCES memories(id) ON DELETE SET NULL;

-- Notify PostgREST to reload the schema map
NOTIFY pgrst, 'reload schema';
