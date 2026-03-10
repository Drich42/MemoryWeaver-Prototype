-- Adding email column to persons table
ALTER TABLE persons ADD COLUMN email TEXT;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
