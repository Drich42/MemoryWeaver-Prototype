-- 1. Events Table Updates
ALTER TABLE events ADD COLUMN date_text TEXT;

-- 2. Persons Table Updates (Birth and Death)
ALTER TABLE persons RENAME COLUMN birth_date TO birth_start_date;
ALTER TABLE persons ADD COLUMN birth_end_date DATE;
ALTER TABLE persons ADD COLUMN birth_text TEXT;

ALTER TABLE persons RENAME COLUMN death_date TO death_start_date;
ALTER TABLE persons ADD COLUMN death_end_date DATE;
ALTER TABLE persons ADD COLUMN death_text TEXT;

-- 3. Memories Table Updates
ALTER TABLE memories RENAME COLUMN capture_date TO start_date;
ALTER TABLE memories ADD COLUMN end_date DATE;
ALTER TABLE memories ADD COLUMN date_text TEXT;

-- 4. Backfill existing end dates to match start dates for exact dates
UPDATE persons SET birth_end_date = birth_start_date WHERE birth_start_date IS NOT NULL;
UPDATE persons SET death_end_date = death_start_date WHERE death_start_date IS NOT NULL;
UPDATE memories SET end_date = start_date WHERE start_date IS NOT NULL;

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
