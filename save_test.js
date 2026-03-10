import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').filter(Boolean).forEach(line => {
  const [key, ...val] = line.split('=');
  const v = val.join('=').trim().replace(/['"]/g, '');
  if(key) env[key.trim()] = v;
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
  const { data } = await supabase.from('memories').select('id, title, start_date, end_date, date_text').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2));
})();
