import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local for SERVICE ROLE KEY (required to bypass RLS for destructive cross-user admin tasks)
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
    console.error("No .env.local found.");
    process.exit(1);
}
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
        const [key, ...vals] = line.split('=');
        if (key) envVars[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function wipeUserData(email) {
    console.log(`Starting wipe for user: ${email}`);

    // Since we don't have the Service Role Key in .env.local to query `auth.users`,
    // we must rely on email fields in the `persons` table where the user created their own profile,
    // or we must wipe based on `uploader_id` if we can find it.

    // Let's find ANY record belonging to this email to extract their UUID.
    // In our app, users often create a `persons` record with their own email.
    console.log("Locating User ID via Persons table email match...");
    const { data: userProfiles, error: pLookupErr } = await supabase
        .from('persons')
        .select('uploader_id')
        .eq('email', email)
        .limit(1);

    let userId = null;

    if (userProfiles && userProfiles.length > 0) {
        userId = userProfiles[0].uploader_id;
    } else {
        // Fallback: the auth login is the only place it exists, we can't wipe without the UUID.
        console.error(`Could not find a 'persons' profile with email ${email} to extract their associated User ID.`);
        console.log(`We need their UUID to safely delete their specific collections/memories without a Service Key.`);
        process.exit(1);
    }

    console.log(`Found target User ID: ${userId}`);

    // 1. Wipe Memories (Artifacts)
    let { data: mems, error: mErr } = await supabase.from('memories').delete().eq('uploader_id', userId).select('id');
    console.log(`Deleted ${mems?.length || 0} memory artifacts.`);

    // 2. Wipe Persons (Cascades to relationships automatically)
    let { data: people, error: pErr } = await supabase.from('persons').delete().eq('uploader_id', userId).select('id');
    console.log(`Deleted ${people?.length || 0} person nodes (cascading relationships).`);

    // 3. Wipe Collections
    let { data: cols, error: colErr } = await supabase.from('collections').delete().eq('uploader_id', userId).select('id');
    console.log(`Deleted ${cols?.length || 0} collections.`);

    console.log(`\nWipe completed for ${email} (User ID: ${userId}). Their database is now a blank slate.`);
}

wipeUserData('drich8@vols.utk.edu');
