import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, ImageIcon, DownloadCloud } from 'lucide-react';

export default function ImportReview() {
    // collection_id
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const memoryIdsStr = searchParams.get('memories');
    const selectedMemoryIds = memoryIdsStr ? memoryIdsStr.split(',') : [];

    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [share, setShare] = useState(null);
    const [memoriesToImport, setMemoriesToImport] = useState([]);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Conflict Resolution State
    const [existingPersons, setExistingPersons] = useState([]);
    const [incomingPersons, setIncomingPersons] = useState([]);
    const [personMapping, setPersonMapping] = useState({}); // { incoming_person_id: 'CREATE_NEW' | existing_person_id }

    useEffect(() => {
        async function fetchImportData() {
            try {
                setLoading(true);
                
                // 1. Fetch the Share Record to determine permissions (include_bio, include_context)
                const { data: shareData, error: shareError } = await supabase
                    .from('shares')
                    .select('*')
                    .eq('collection_id', id)
                    .eq('recipient_email', user?.email)
                    .eq('status', 'accepted')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (shareError) throw new Error("Could not verify your access to this shared collection.");
                
                setShare(shareData);

                // 2. Fetch the specific Memories they selected to import
                if (selectedMemoryIds.length === 0) throw new Error("No memories were selected for import.");

                const { data: memData, error: memError } = await supabase
                    .from('memories')
                    .select(`
                        *,
                        memory_persons ( role, person_id, persons ( id, display_name ) )
                    `)
                    .in('id', selectedMemoryIds);
                
                if (memError) throw memError;
                setMemoriesToImport(memData || []);

                // 3. Fetch existing persons for mapping dropdown
                const { data: personsData, error: personsError } = await supabase
                    .from('persons')
                    .select('id, display_name')
                    .order('display_name');
                if (!personsError && personsData) {
                    setExistingPersons(personsData);
                }

            } catch (err) {
                console.error("Error fetching import data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        if (user) {
            fetchImportData();
        }
    }, [id, user, memoryIdsStr]);

    // Extract unique incoming persons from the specific memories
    useEffect(() => {
        if (!share || !share.include_bio || memoriesToImport.length === 0) return;

        let allEdges = [];
        memoriesToImport.forEach(mem => {
            if (mem?.memory_persons) {
                allEdges = allEdges.concat(mem.memory_persons);
            }
        });

        const uniquePersonsMap = new Map();
        allEdges.forEach(edge => {
            if (edge.persons && !uniquePersonsMap.has(edge.persons.id)) {
                uniquePersonsMap.set(edge.persons.id, edge.persons);
            }
        });

        const uniquePersonsList = Array.from(uniquePersonsMap.values());
        setIncomingPersons(uniquePersonsList);

        // Pre-fill mapping to default to CREATE_NEW
        const initialMapping = {};
        uniquePersonsList.forEach(p => {
            initialMapping[p.id] = 'CREATE_NEW';
        });
        setPersonMapping(initialMapping);

    }, [share, memoriesToImport]);

    const handleImport = async () => {
        if (!share || memoriesToImport.length === 0) return;
        setIsProcessing(true);

        try {
            // Step 1: Process "CREATE_NEW" profile mappings
            const resolvedMapping = { ...personMapping }; // incoming_id -> absolute_local_id

            if (share.include_bio) {
                for (const incomingId of Object.keys(personMapping)) {
                    if (personMapping[incomingId] === 'CREATE_NEW') {
                        const originalPerson = incomingPersons.find(p => p.id === incomingId);
                        if (originalPerson) {
                            const { data: newPerson, error: insertError } = await supabase
                                .from('persons')
                                .insert([{ display_name: originalPerson.display_name }])
                                .select()
                                .single();

                            if (insertError) throw insertError;
                            resolvedMapping[incomingId] = newPerson.id;
                        }
                    } else if (personMapping[incomingId] && personMapping[incomingId] !== 'CREATE_NEW') {
                        resolvedMapping[incomingId] = personMapping[incomingId];
                    }
                }

                // Step 2: Clone Person Relationships for mapped actors
                if (Object.keys(resolvedMapping).length > 0) {
                    const incomingIds = Object.keys(personMapping);
                    if (incomingIds.length > 0) {
                        try {
                            const { data: existingRels } = await supabase
                                .from('person_relationships')
                                .select('*')
                                .in('person1_id', incomingIds)
                                .in('person2_id', incomingIds);
                            
                            if (existingRels && existingRels.length > 0) {
                                const newRels = existingRels.map(rel => {
                                    const newP1 = resolvedMapping[rel.person1_id];
                                    const newP2 = resolvedMapping[rel.person2_id];
                                    if (!newP1 || !newP2) return null;
                                    
                                    return {
                                        person1_id: newP1,
                                        person2_id: newP2,
                                        relationship_type: rel.relationship_type,
                                        owner_id: user?.id
                                    };
                                }).filter(Boolean);

                                const validNewRels = newRels.filter(r => r.person1_id !== r.person2_id);
                                if (validNewRels.length > 0) {
                                    const uniqueRelsMap = new Set();
                                    const deduplicatedRels = [];
                                    validNewRels.forEach(r => {
                                        const hash1 = `${r.person1_id}_${r.person2_id}_${r.relationship_type}`;
                                        if (!uniqueRelsMap.has(hash1)) {
                                            uniqueRelsMap.add(hash1);
                                            deduplicatedRels.push(r);
                                        }
                                    });

                                    await supabase.from('person_relationships').insert(deduplicatedRels);
                                }
                            }
                        } catch (err) {
                            console.warn("Unable to process person_relationships during import clone.", err);
                        }
                    }
                }
            }

            // Step 3: Clone the specific memories and attach their resolved edges
            for (const originalMemory of memoriesToImport) {
                const { data: newMemory, error: memCloneError } = await supabase
                    .from('memories')
                    .insert([{
                        title: originalMemory.title,
                        type: originalMemory.type,
                        artifact_url: originalMemory.artifact_url,
                        thumbnail_url: originalMemory.thumbnail_url,
                        description: share.include_context ? originalMemory.description : null,
                        date_text: share.include_context ? originalMemory.date_text : null,
                        start_date: share.include_context ? originalMemory.start_date : null,
                        end_date: share.include_context ? originalMemory.end_date : null,
                        uploader_id: user?.id,
                        status: 'draft' // Keeps them private to the user until they curate them
                    }])
                    .select()
                    .single();

                if (memCloneError) throw memCloneError;

                // Bind Bio Tags
                if (share.include_bio && originalMemory.memory_persons?.length > 0) {
                    const bioEdges = originalMemory.memory_persons;
                    const newBioEdges = bioEdges.map(edge => {
                        const resolvedPersonId = edge.persons ? resolvedMapping[edge.persons.id] : null; 
                        if (!resolvedPersonId) return null;
                        return {
                            memory_id: newMemory.id,
                            person_id: resolvedPersonId,
                            role: edge.role || 'subject'
                        };
                    }).filter(Boolean);

                    if (newBioEdges.length > 0) {
                        await supabase.from('memory_persons').insert(newBioEdges);
                    }
                }
            }

            alert("Successfully imported items to your archive!");
            navigate('/archives');

        } catch (err) {
            console.error("Error importing memories:", err);
            alert("Failed to integrate into your archive: " + err.message);
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan"></div>
            </div>
        );
    }

    if (error || !share) {
        return (
            <div className="max-w-xl mx-auto mt-12 p-8 text-center bg-red-50 text-red-800 rounded-2xl border border-red-200 shadow-sm">
                <p className="font-bold text-lg mb-2">Notice</p>
                <p className="mb-6">{error || 'An error occurred fetching the artifacts.'}</p>
                <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 bg-red-800 text-white rounded-lg font-medium hover:bg-red-900 transition-colors">
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium mb-6">
                <ArrowLeft size={18} /> Back to Shared Collection
            </button>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                    <DownloadCloud className="w-10 h-10 text-accent-cyan" />
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold font-serif text-slate-900 dark:text-slate-100">Import Selection</h1>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">Resolve tags and finalize the import of {memoriesToImport.length} photos into your archive.</p>
                    </div>
                </div>

                <div className="p-6 md:p-8 flex flex-col gap-8">
                    {/* Bio Tag Resolution Block */}
                    {share.include_bio && incomingPersons.length > 0 && (
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-lg">Resolve Biological Tags</h3>
                            <p className="text-sm text-slate-500 mb-4">The selected artifacts contain tags for {incomingPersons.length} people. Would you like to create new profiles for them in your lineage, or map them to existing profiles?</p>

                            <div className="space-y-3">
                                {incomingPersons.map(person => (
                                    <div key={person.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <span className="font-medium text-slate-800 dark:text-slate-200">{person.display_name}</span>
                                        <select
                                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg p-2 focus:ring-accent-cyan focus:border-accent-cyan block w-full md:w-auto"
                                            value={personMapping[person.id] || 'CREATE_NEW'}
                                            onChange={(e) => setPersonMapping({ ...personMapping, [person.id]: e.target.value })}
                                        >
                                            <option value="CREATE_NEW">+ Create Brand New Profile</option>
                                            <optgroup label="Merge with Existing:">
                                                {existingPersons.map(ep => (
                                                    <option key={ep.id} value={ep.id}>{ep.display_name}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {!share.include_bio && (
                         <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                             <p className="text-sm text-slate-600 dark:text-slate-400">Biological tags were not included in this share. The photos will be imported without actor links.</p>
                         </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-6 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-wrap">
                        <button
                            onClick={() => navigate(-1)}
                            disabled={isProcessing}
                            className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={isProcessing}
                            className="px-6 py-2.5 bg-accent-cyan text-slate-900 font-bold rounded-xl shadow-md shadow-accent-cyan/20 hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
                        >
                            {isProcessing ? 'Importing...' : 'Complete Import'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
