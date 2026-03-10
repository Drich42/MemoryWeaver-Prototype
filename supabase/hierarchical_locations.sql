-- Migration: Add Hierarchical Location Columns to `places`

-- 1. Rename existing 'name' column to 'placename' for better semantic matching
ALTER TABLE public.places 
RENAME COLUMN name TO placename;

-- 2. Add the new hierarchical columns
ALTER TABLE public.places
ADD COLUMN IF NOT EXISTS city_town TEXT,
ADD COLUMN IF NOT EXISTS county TEXT,
ADD COLUMN IF NOT EXISTS state_region TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- NOTE: 'address' column already exists in schema, keeping it for street-level data
-- NOTE: 'type' column already exists (can still be used for categorized like 'base', 'cemetery', etc.)

-- 3. (Optional but recommended) Add an index on country and state since they'll be heavily filtered
CREATE INDEX IF NOT EXISTS idx_places_country ON public.places (country);
CREATE INDEX IF NOT EXISTS idx_places_state_region ON public.places (state_region);
