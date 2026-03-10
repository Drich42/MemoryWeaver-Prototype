-- Enable RLS for collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable public insert for collections" ON collections FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable public select for collections" ON collections FOR SELECT USING (true);
CREATE POLICY "Enable public update for collections" ON collections FOR UPDATE USING (true);
CREATE POLICY "Enable public delete for collections" ON collections FOR DELETE USING (true);

-- Enable RLS for memory_collections
ALTER TABLE memory_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable public insert for memory_collections" ON memory_collections FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable public select for memory_collections" ON memory_collections FOR SELECT USING (true);
CREATE POLICY "Enable public update for memory_collections" ON memory_collections FOR UPDATE USING (true);
CREATE POLICY "Enable public delete for memory_collections" ON memory_collections FOR DELETE USING (true);
