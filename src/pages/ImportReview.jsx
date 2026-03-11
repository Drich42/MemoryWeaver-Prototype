import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, ImageIcon, DownloadCloud, Sparkles, AlertCircle, ArrowRight, UserPlus, Users } from 'lucide-react';
import { findBestMatch } from '../utils/fuzzyMatch';

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

    // Wizard State
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 4;

    // Conflict Resolution State
    const [existingPersons, setExistingPersons] = useState([]);
    const [incomingPersons, setIncomingPersons] = useState([]);
    const [personMapping, setPersonMapping] = useState({}); // { incoming_person_id: 'CREATE_NEW' | existing_person_id | 'SKIP' }
    const [matchConfidences, setMatchConfidences] = useState({}); // { incoming_person_id: number }

    // Relationship Review State
    const [incomingRelationships, setIncomingRelationships] = useState([]);
    const [relationshipMapping, setRelationshipMapping] = useState({}); // { `${p1}_${p2}_${type}`: boolean (true means import) }

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

        // Pre-fill mapping using Fuzzy Matching
        const initialMapping = {};
        const confidences = {};

        uniquePersonsList.forEach(p => {
            const bestMatch = findBestMatch(p.display_name, existingPersons);
            if (bestMatch) {
                initialMapping[p.id] = bestMatch.match.id;
                confidences[p.id] = bestMatch.score;
            } else {
                initialMapping[p.id] = 'CREATE_NEW';
                confidences[p.id] = 0;
            }
        });
        
        setPersonMapping(initialMapping);
        setMatchConfidences(confidences);

    }, [share, memoriesToImport, existingPersons]);

    // Extract Relationships once Actor Mapping is "Confirmed" (i.e. we are on Step 3)
    useEffect(() => {
        async function fetchRels() {
            if (currentStep !== 3 || incomingPersons.length === 0 || !share.include_bio) return;

            const incomingIds = incomingPersons.map(p => p.id);
            if (incomingIds.length === 0) return;

            try {
                // We fetch the original source relationships among the incoming persons
                const { data: sourceRels, error: relError } = await supabase
                    .from('person_relationships')
                    .select('*')
                    .in('person1_id', incomingIds)
                    .in('person2_id', incomingIds);
                
                if (!relError && sourceRels) {
                    setIncomingRelationships(sourceRels);
                    
                    // Default to importing all discovered relationships
                    const rMap = {};
                    sourceRels.forEach(r => {
                        rMap[`${r.person1_id}_${r.person2_id}_${r.relationship_type}`] = true;
                    });
                    setRelationshipMapping(rMap);
                }
            } catch (err) {
                console.error("Failed to load source relationships:", err);
            }
        }
        fetchRels();
    }, [currentStep, incomingPersons, share]);

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
                // ONLY clone the ones the user left checked in Step 3
                if (Object.keys(resolvedMapping).length > 0 && incomingRelationships.length > 0) {
                    const relsToCreate = incomingRelationships.filter(r => relationshipMapping[`${r.person1_id}_${r.person2_id}_${r.relationship_type}`]);
                    
                    if (relsToCreate.length > 0) {
                        try {
                            const newRels = relsToCreate.map(rel => {
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

                                // Upsert logic/Catch conflicts if relationship already exists
                                const { error: insertRelsError } = await supabase.from('person_relationships').insert(deduplicatedRels);
                                if (insertRelsError) {
                                    console.warn("Could not insert cloned relationships (they might already exist).", insertRelsError);
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
                        status: 'draft', // Keeps them private to the user until they curate them
                        imported_from_share_id: share.id,
                        original_memory_id: originalMemory.id
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

    const nextStep = () => {
        // If Bio isn't included or no persons present, skip Steps 2 and 3
        if (currentStep === 1 && (!share.include_bio || incomingPersons.length === 0)) {
            setCurrentStep(4);
        } else if (currentStep === 2 && incomingRelationships.length === 0) {
            setCurrentStep(4); // Skip rel review if no rels
        } else {
            setCurrentStep(prev => Math.min(prev + 1, totalSteps));
        }
    };
    
    const prevStep = () => {
        if (currentStep === 4 && (!share.include_bio || incomingPersons.length === 0)) {
            setCurrentStep(1);
        } else {
            setCurrentStep(prev => Math.max(prev - 1, 1));
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium mb-6">
                <ArrowLeft size={18} /> Back to Shared Collection
            </button>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden min-h-[500px] flex flex-col">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <DownloadCloud className="w-10 h-10 text-accent-cyan" />
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold font-serif text-slate-900 dark:text-slate-100">Intelligent Import</h1>
                            <p className="text-slate-600 dark:text-slate-400 mt-1">Step {currentStep} of {totalSteps}: {
                                currentStep === 1 ? 'Payload Overview' :
                                currentStep === 2 ? 'Identify Actors' :
                                currentStep === 3 ? 'Verify Family Links' : 'Final Review'
                            }</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-8 flex-1 flex flex-col">
                    
                    {/* STEP 1: OVERVIEW */}
                    {currentStep === 1 && (
                        <div className="space-y-6 flex-1 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xl">Review Payload Data</h3>
                            <p className="text-slate-500">You are about to securely import these items into your personal archive.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center shadow-sm">
                                    <ImageIcon className="mx-auto w-8 h-8 text-slate-400 mb-3" />
                                    <div className="text-3xl font-black text-slate-800">{memoriesToImport.length}</div>
                                    <div className="font-bold text-slate-500 mt-1">Artifacts</div>
                                </div>
                                
                                {share.include_bio ? (
                                    <>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center shadow-sm">
                                            <Users className="mx-auto w-8 h-8 text-accent-cyan mb-3" />
                                            <div className="text-3xl font-black text-accent-cyan">{incomingPersons.length}</div>
                                            <div className="font-bold text-slate-500 mt-1">Tagged Profiles</div>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center shadow-sm">
                                            <UserPlus className="mx-auto w-8 h-8 text-indigo-400 mb-3" />
                                            <div className="text-3xl font-black text-indigo-500">?</div>
                                            <div className="font-bold text-slate-500 mt-1">Family Links</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
                                        <AlertCircle className="w-8 h-8 text-amber-500 mb-3" />
                                        <div className="font-bold text-slate-500">Biological tags were not included by the sender.</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 2: ACTOR RESOLUTION */}
                    {currentStep === 2 && (
                         <div className="space-y-6 flex-1 animate-in fade-in slide-in-from-right-4 duration-300">
                             <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-amber-500" />
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xl">Identify Actors</h3>
                             </div>
                             <p className="text-slate-500">We analyzed the {incomingPersons.length} tagged people in this payload. Tell us if these are new individuals or if they already exist in your archive.</p>

                             <div className="space-y-4 mt-4">
                                 {incomingPersons.map(person => {
                                     const isMerged = personMapping[person.id] && personMapping[person.id] !== 'CREATE_NEW';
                                     const mappedPersonId = personMapping[person.id];
                                     const mappedPerson = existingPersons.find(p => p.id === mappedPersonId);
                                     const confidence = matchConfidences[person.id] || 0;

                                     return (
                                        <div key={person.id} className={`rounded-xl p-5 border shadow-sm transition-colors ${isMerged ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                
                                                <div className="flex-1">
                                                    <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Incoming Tag</div>
                                                    <div className="font-serif font-bold text-xl text-slate-800">{person.display_name}</div>
                                                    
                                                    {confidence > 0.4 && personMapping[person.id] === 'CREATE_NEW' && (
                                                        <div className="mt-2 text-sm text-amber-600 font-medium flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 inline-flex">
                                                            <Sparkles size={14} /> Similar to an existing profile in your archive.
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="shrink-0 flex items-center gap-3">
                                                    <ArrowRight className="text-slate-300 hidden md:block" />
                                                    <div className="w-full md:w-64">
                                                        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Your Archive</div>
                                                        <select
                                                            className={`w-full border text-sm rounded-lg p-2.5 font-bold shadow-sm focus:ring-accent-cyan focus:border-accent-cyan ${isMerged ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white border-slate-300 text-slate-700'}`}
                                                            value={personMapping[person.id] || 'CREATE_NEW'}
                                                            onChange={(e) => setPersonMapping({ ...personMapping, [person.id]: e.target.value })}
                                                        >
                                                            <option value="CREATE_NEW">✨ Create Brand New Profile</option>
                                                            <optgroup label="Merge with Existing Profile:">
                                                                {existingPersons.map(ep => (
                                                                    <option key={ep.id} value={ep.id}>
                                                                        Merge into: {ep.display_name}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                     );
                                 })}
                             </div>
                         </div>
                    )}

                    {/* STEP 3: RELATIONSHIP REVIEW */}
                    {currentStep === 3 && (
                         <div className="space-y-6 flex-1 animate-in fade-in slide-in-from-right-4 duration-300">
                             <div className="flex items-center gap-2 mb-2">
                                <Users className="w-5 h-5 text-indigo-500" />
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xl">Verify Family Links</h3>
                             </div>
                             
                             {incomingRelationships.length === 0 ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                                    <p>No family relationships were found among the actors in this payload.</p>
                                </div>
                             ) : (
                                <>
                                    <p className="text-slate-500">We detected {incomingRelationships.length} relationship links between these people. Uncheck any connections you disagree with or don't want in your tree.</p>
                                    
                                    <div className="grid grid-cols-1 gap-3 mt-4">
                                        {incomingRelationships.map(rel => {
                                            const p1Incoming = incomingPersons.find(p => p.id === rel.person1_id);
                                            const p2Incoming = incomingPersons.find(p => p.id === rel.person2_id);
                                            
                                            const p1Name = p1Incoming?.display_name || 'Unknown';
                                            const p2Name = p2Incoming?.display_name || 'Unknown';
                                            const key = `${rel.person1_id}_${rel.person2_id}_${rel.relationship_type}`;
                                            const isChecked = relationshipMapping[key] || false;

                                            return (
                                                <label key={key} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${isChecked ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked}
                                                        onChange={(e) => setRelationshipMapping({...relationshipMapping, [key]: e.target.checked})}
                                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-800 text-lg">
                                                            {p1Name} <span className="text-slate-400 font-normal italic mx-1">is the {rel.relationship_type.replace('_',' ')} of</span> {p2Name}
                                                        </div>
                                                    </div>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </>
                             )}
                         </div>
                    )}

                    {/* STEP 4: FINAL CHECK */}
                    {currentStep === 4 && (
                        <div className="space-y-6 flex-1 flex flex-col items-center justify-center animate-in fade-in slide-in-from-right-4 duration-300 py-12 text-center">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={40} />
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-3xl font-serif">Ready to Import</h3>
                            <p className="text-slate-500 max-w-md mx-auto">Click "Commit Import" below to finalize your mapping and copy these {memoriesToImport.length} artifacts into your personal archive.</p>
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                        <button
                            onClick={currentStep === 1 ? () => navigate(-1) : prevStep}
                            disabled={isProcessing}
                            className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {currentStep === 1 ? 'Cancel' : 'Go Back'}
                        </button>

                        {currentStep < 4 ? (
                            <button
                                onClick={nextStep}
                                disabled={isProcessing}
                                className="px-8 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors"
                            >
                                Continue
                            </button>
                        ) : (
                            <button
                                onClick={handleImport}
                                disabled={isProcessing}
                                className="px-8 py-2.5 bg-accent-cyan text-slate-900 font-bold rounded-xl shadow-md shadow-accent-cyan/20 hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <DownloadCloud size={18} />
                                {isProcessing ? 'Processing Data...' : 'Commit Import'}
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
