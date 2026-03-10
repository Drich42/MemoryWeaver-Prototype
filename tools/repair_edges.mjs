import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual simple parsing of .env.local
const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function repairEdges() {
    const { data: edges, error } = await supabase.from('person_relationships').select('*');
    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    const edgeMap = new Set(edges.map(e => `${e.person_a_id}|${e.person_b_id}|${e.relationship_type}`));
    const toInsert = [];

    const getReciprocalType = (type) => {
        switch (type) {
            case 'parent': return 'child';
            case 'child': return 'parent';
            case 'stepparent': return 'stepchild';
            case 'stepchild': return 'stepparent';
            case 'spouse': return 'spouse';
            default: return null;
        }
    };

    edges.forEach(edge => {
        const recType = getReciprocalType(edge.relationship_type);
        if (!recType) return;

        const recKey = `${edge.person_b_id}|${edge.person_a_id}|${recType}`;
        if (!edgeMap.has(recKey)) {
            console.log(`Missing reciprocal edge! Found ${edge.person_a_id} -> ${edge.person_b_id} (${edge.relationship_type}). Missing reverse (${recType}).`);
            toInsert.push({
                person_a_id: edge.person_b_id,
                person_b_id: edge.person_a_id,
                relationship_type: recType,
                start_date: edge.start_date,
                end_date: edge.end_date
            });
            // prevent pushing the same reciprocal edge multiple times if we have duplicates
            edgeMap.add(recKey);
        }
    });

    if (toInsert.length > 0) {
        console.log(`Inserting ${toInsert.length} missing reciprocal edges...`);
        const { error: insertError } = await supabase.from('person_relationships').insert(toInsert);
        if (insertError) {
            console.error("Insert failed:", insertError);
        } else {
            console.log("Repair complete!");
        }
    } else {
        console.log("All edges are perfectly bidirectional! No repair needed.");
    }
}

repairEdges();
