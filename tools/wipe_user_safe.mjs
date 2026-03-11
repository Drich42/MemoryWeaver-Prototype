import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
        const [key, ...vals] = line.split('=');
        if (key) envVars[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'] || envVars['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipe() {
    const targetEmail = 'drich8@vols.utk.edu';
    console.log(`Starting wipe for: ${targetEmail}`);

    const { data: users, error: uErr } = await supabase.from('persons').select('uploader_id').eq('email', targetEmail).limit(1);

    if (uErr) {
        console.error("DB Error:", uErr);
        process.exit(1);
    }

    if (!users || users.length === 0 || !users[0].uploader_id) {
        console.error("Could not find uploader_id for that email in the persons table.");
        process.exit(1);
    }

    const uid = users[0].uploader_id;
    console.log("Found User ID:", uid);

    // Deletions
    console.log("Deleting memories...");
    const { data: d1, error: e1 } = await supabase.from('memories').delete().eq('uploader_id', uid).select('id');
    console.log(`Deleted ${d1?.length || 0} memories.`);

    console.log("Deleting persons (and relationships via CASCADE)...");
    const { data: d2, error: e2 } = await supabase.from('persons').delete().eq('uploader_id', uid).select('id');
    console.log(`Deleted ${d2?.length || 0} persons.`);

    console.log("Deleting collections...");
    const { data: d3, error: e3 } = await supabase.from('collections').delete().eq('uploader_id', uid).select('id');
    console.log(`Deleted ${d3?.length || 0} collections.`);

    console.log("Done!");
    process.exit(0);
}

// Wrap in a try-catch to prevent native process crashes from unhandled rejections
wipe().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
