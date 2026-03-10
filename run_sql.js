import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSQL() {
  const sqlCommand = fs.readFileSync('./supabase/collections_rls.sql', 'utf8');
  console.log("Running SQL...");
  const { data, error } = await supabase.rpc('exec_sql', { query: sqlCommand }).catch(async (e) => {
     // fallback if rpc exec_sql isn't available
     console.log("RPC exec_sql not found, trying raw query via pg or similar setup if possible... wait, Supabase JS client doesn't support raw SQL from client side without RPC.");
     return {error: e};
  });
  
  if (error) {
    console.error("Failed to run SQL:", error);
  } else {
    console.log("SQL executed successfully.");
  }
}

runSQL();
