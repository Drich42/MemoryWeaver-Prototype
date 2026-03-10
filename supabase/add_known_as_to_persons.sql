-- Adding known_as column to persons table
ALTER TABLE persons ADD COLUMN IF NOT EXISTS known_as TEXT;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
