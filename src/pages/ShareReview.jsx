import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, XCircle, ImageIcon } from 'lucide-react';

export default function ShareReview() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [share, setShare] = useState(null);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Conflict Resolution State
    const [existingPersons, setExistingPersons] = useState([]);
    const [incomingPersons, setIncomingPersons] = useState([]);
    const [personMapping, setPersonMapping] = useState({}); // { incoming_person_id: 'CREATE_NEW' | existing_person_id }

    useEffect(() => {
        async function fetchShare() {
            try {
                setLoading(true);
                // Fetch share details along with the associated memory
                const { data, error: fetchError } = await supabase
                    .from('shares')
                    .select(`
            *,
            memories (
              *,
              memory_persons ( persons ( id, display_name ) )
            ),
            collections (
              *,
              memory_collections (
                memories (
                  *,
                  memory_persons ( persons ( id, display_name ) )
                )
              )
            )
          `)
                    .eq('id', id)
                    .single();

                if (fetchError) throw fetchError;
                if (!data) throw new Error("Share request not found.");

                if (user && data.recipient_email !== user.email) {
                    throw new Error("You are not authorized to view this share request.");
                }

                if (!data.memories && !data.collections) {
                    throw new Error("The associated artifact or collection for this share is missing or no longer exists. It may have been deleted by the sender.");
                }

                setShare(data);

                // Fetch existing persons for the mapping dropdown
                const { data: personsData, error: personsError } = await supabase
                    .from('persons')
                    .select('id, display_name')
                    .order('display_name');
                if (!personsError && personsData) {
                    setExistingPersons(personsData);
                }

            } catch (err) {
                console.error("Error fetching share:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchShare();
    }, [id, user]);

    // Extract unique incoming persons
    useEffect(() => {
        if (!share || !share.include_bio) return;

        const isCollection = !!share.collection_id;
        let allEdges = [];

        if (isCollection) {
            share.collections?.memory_collections?.forEach(mc => {
                const mem = mc.memories;
                if (mem?.memory_persons) {
                    allEdges = allEdges.concat(mem.memory_persons);
                }
            });
        } else {
            allEdges = share.memories?.memory_persons || [];
        }

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

    }, [share]);

    const handleAccept = async () => {
        if (!share) return;
        setIsProcessing(true);

        try {
            const isCollection = !!share.collection_id;

            // Step 0: Process all "CREATE_NEW" profile mappings first
            // Only do this if bio data was included in the share
            const resolvedMapping = { ...personMapping }; // incoming_id -> absolute_local_id

            if (share.include_bio) {
                for (const incomingId of Object.keys(personMapping)) {
                    if (personMapping[incomingId] === 'CREATE_NEW') {
                        // Find original record
                        const originalPerson = incomingPersons.find(p => p.id === incomingId);
                        if (originalPerson) {
                            console.log("Creating new person profile for (ShareReview):", originalPerson.display_name);
                            const { data: newPerson, error: insertError } = await supabase
                                .from('persons')
                                .insert([{
                                    display_name: originalPerson.display_name,
                                    // Assuming basic info copies over, but keeping it simple for prototype
                                }])
                                .select()
                                .single();

                            if (insertError) {
                                console.error("Failed to create new person profile:", insertError);
                                throw insertError;
                            }
                            resolvedMapping[incomingId] = newPerson.id; // Update map with the fresh ID
                        }
                    } else if (personMapping[incomingId] && personMapping[incomingId] !== 'CREATE_NEW') {
                        // It's an existing mapped person ID, use it directly
                        resolvedMapping[incomingId] = personMapping[incomingId];
                    }
                }
            }

            if (isCollection) {
                const originalCol = share.collections;

                // 1. Clone the collection itself
                const { data: newCol, error: colCloneError } = await supabase
                    .from('collections')
                    .insert([{
                        name: originalCol.name,
                        description: originalCol.description,
                        owner_id: user?.id
                    }])
                    .select()
                    .single();

                if (colCloneError) throw colCloneError;

                const memEdges = originalCol.memory_collections || [];
                const edgesToInsert = [];

                // 2. Loop through and clone each memory inside
                for (const mcEdge of memEdges) {
                    const originalMemory = mcEdge.memories;
                    if (!originalMemory) continue;

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
                            status: 'draft'
                        }])
                        .select()
                        .single();

                    if (memCloneError) throw memCloneError;

                    // Prepare collection link
                    edgesToInsert.push({ memory_id: newMemory.id, collection_id: newCol.id });

                    // Clone bio tags
                    if (share.include_bio && originalMemory.memory_persons?.length > 0) {
                        const { data: bioEdges } = await supabase
                            .from('memory_persons')
                            .select('*')
                            .eq('memory_id', originalMemory.id);

                        if (bioEdges && bioEdges.length > 0) {
                            const newBioEdges = bioEdges.map(edge => {
                                const resolvedPersonId = resolvedMapping[edge.person_id];
                                if (!resolvedPersonId) return null; // Safety skip if missing
                                return {
                                    memory_id: newMemory.id,
                                    person_id: resolvedPersonId,
                                    role: edge.role
                                };
                            }).filter(Boolean);

                            if (newBioEdges.length > 0) {
                                console.log("Attempting to insert edge links via clone loop:", newBioEdges);
                                const { error: edgeInsertError } = await supabase.from('memory_persons').insert(newBioEdges);
                                if (edgeInsertError) {
                                    console.error("Failed to insert memory_persons edge:", edgeInsertError);
                                    throw edgeInsertError;
                                }
                            }
                        }
                    }
                }

                // 3. Insert all new collection links
                if (edgesToInsert.length > 0) {
                    await supabase.from('memory_collections').insert(edgesToInsert);
                }

                // 4. Update share status & Redirect
                await supabase.from('shares').update({ status: 'accepted' }).eq('id', share.id);
                navigate(`/collections/${newCol.id}`);

            } else {
                // EXISTING SINGLE MEMORY LOGIC
                const originalMemory = share.memories;
                const { data: newMemory, error: cloneError } = await supabase
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
                        status: 'draft'
                    }])
                    .select()
                    .single();

                if (cloneError) throw cloneError;

                if (share.include_bio && originalMemory.memory_persons?.length > 0) {
                    const { data: edges } = await supabase.from('memory_persons').select('*').eq('memory_id', originalMemory.id);
                    if (edges && edges.length > 0) {
                        const newEdges = edges.map(edge => {
                            const resolvedPersonId = resolvedMapping[edge.person_id];
                            if (!resolvedPersonId) return null;
                            return { memory_id: newMemory.id, person_id: resolvedPersonId, role: edge.role };
                        }).filter(Boolean);

                        if (newEdges.length > 0) {
                            console.log("Attempting to insert single edge links via clone loop:", newEdges);
                            const { error: edgeInsertError } = await supabase.from('memory_persons').insert(newEdges);
                            if (edgeInsertError) {
                                console.error("Failed to insert single memory_persons edge:", edgeInsertError);
                                throw edgeInsertError;
                            }
                        }
                    }
                }

                await supabase.from('shares').update({ status: 'accepted' }).eq('id', share.id);
                navigate(`/memories/${newMemory.id}`);
            }

        } catch (err) {
            console.error("Error accepting share:", err);
            alert("Failed to integrate into your archive: " + err.message);
            setIsProcessing(false);
        }
    };

    const handleDecline = async () => {
        if (!window.confirm("Are you sure you want to dismiss this share?")) return;
        setIsProcessing(true);
        try {
            await supabase
                .from('shares')
                .update({ status: 'rejected' })
                .eq('id', share.id);

            navigate('/');
        } catch (err) {
            console.error("Error rejecting share:", err);
            alert("Failed to update status.");
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || !share) {
        return (
            <div className="max-w-xl mx-auto mt-12 p-8 text-center bg-red-50 text-red-800 rounded-2xl border border-red-200 shadow-sm">
                <XCircle className="mx-auto h-12 w-12 mb-4 text-red-400" />
                <p className="font-bold text-lg mb-2">Invalid or Missing Share</p>
                <p className="mb-6">{error || 'This share request does not exist or has already been processed.'}</p>
                <button onClick={() => navigate('/')} className="px-5 py-2.5 bg-red-800 text-white rounded-lg font-medium hover:bg-red-900 transition-colors">
                    Return to Dashboard
                </button>
            </div>
        );
    }

    const isCollection = !!share.collection_id;
    const isProcessed = share.status !== 'pending';

    const mem = isCollection ? null : share.memories;
    const coll = isCollection ? share.collections : null;
    const title = isCollection ? coll.name : mem.title;

    // Derived for UI
    const items = isCollection ? (coll.memory_collections?.map(mc => mc.memories).filter(Boolean) || []) : [];
    const representativeItem = isCollection ? items.find(m => m.thumbnail_url || m.artifact_url) : mem;
    const imageUrl = representativeItem?.thumbnail_url || representativeItem?.artifact_url;
    const typeLabel = isCollection ? 'Collection' : mem.type;

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">

            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium mb-6">
                <ArrowLeft size={18} /> Back to Dashboard
            </button>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden">

                {/* Header Area */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 md:p-8 border-b border-slate-100 dark:border-slate-800">
                    <h1 className="text-2xl md:text-3xl font-bold font-serif text-slate-900 dark:text-slate-100 mb-2">Review Shared {isCollection ? 'Collection' : 'Artifact'}</h1>
                    <p className="text-slate-600 dark:text-slate-400">Another archivist has shared this {isCollection ? 'collection of memories' : 'memory'} with you. You can accept it to create a private copy in your own archive.</p>

                    {isProcessed && (
                        <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${share.status === 'accepted' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {share.status === 'accepted' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                            This share has already been {share.status}.
                        </div>
                    )}
                </div>

                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">

                    {/* Left Column: Visual Preview */}
                    <div className="w-full md:w-1/2 flex flex-col gap-4">
                        <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center relative shadow-inner">
                            {imageUrl ? (
                                <img src={imageUrl} alt={title} className="w-full h-full object-cover bg-slate-200 dark:bg-slate-900" />
                            ) : (
                                <ImageIcon size={64} className="text-slate-300" />
                            )}
                            <div className="absolute top-4 left-4">
                                <span className="bg-slate-900/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{typeLabel}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Metadata & Permissions Breakdown */}
                    <div className="w-full md:w-1/2 flex flex-col">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">{title}</h2>

                        <div className="space-y-6 flex-1">
                            {/* Included Data Breakdown */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Payload Contents Included</h3>

                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3">
                                        <CheckCircle size={18} className="text-primary mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{isCollection ? `Media Assets (${items.length} items)` : 'Media Asset'}</p>
                                            <p className="text-xs text-slate-500 mt-1">Full resolution {isCollection ? 'files' : mem.type} and derived thumbnails.</p>
                                        </div>
                                    </li>

                                    <li className="flex items-start gap-3">
                                        {share.include_context ? (
                                            <CheckCircle size={18} className="text-primary mt-0.5 shrink-0" />
                                        ) : (
                                            <XCircle size={18} className="text-slate-300 mt-0.5 shrink-0" />
                                        )}
                                        <div>
                                            <p className={`font-bold text-sm ${share.include_context ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 line-through'}`}>Story & Context</p>
                                            {share.include_context ? (
                                                <div className="text-xs text-slate-600 mt-1.5 p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 italic border-l-2 border-l-primary">
                                                    {isCollection ? "Includes titles, descriptions, and dates for all artifacts in the collection." : `"${mem.description ? (mem.description.length > 100 ? mem.description.substring(0, 100) + '...' : mem.description) : 'No description provided.'}"`}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 mt-1">The sender opted to withhold contextual notes and dates.</p>
                                            )}
                                        </div>
                                    </li>

                                    <li className="flex items-start gap-3">
                                        {share.include_bio ? (
                                            <CheckCircle size={18} className="text-primary mt-0.5 shrink-0" />
                                        ) : (
                                            <XCircle size={18} className="text-slate-300 mt-0.5 shrink-0" />
                                        )}
                                        <div>
                                            <p className={`font-bold text-sm ${share.include_bio ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 line-through'}`}>Biographical Tags</p>
                                            {share.include_bio ? (
                                                <p className="text-xs text-slate-600 mt-1">Graph links to people will be copied if they exist.</p>
                                            ) : (
                                                <p className="text-xs text-slate-400 mt-1">Biographical graph links were withheld.</p>
                                            )}
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Bio Tag Resolution Block */}
                        {!isProcessed && share.include_bio && incomingPersons.length > 0 && (
                            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-lg">Resolve Biological Tags</h3>
                                <p className="text-sm text-slate-500 mb-4">The sender included tags for {incomingPersons.length} people. Would you like to create new profiles for them, or map them to existing people in your archive?</p>

                                <div className="space-y-3">
                                    {incomingPersons.map(person => (
                                        <div key={person.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <span className="font-medium text-slate-800 dark:text-slate-200">{person.display_name}</span>
                                            <select
                                                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg p-2 focus:ring-primary focus:border-primary block w-full md:w-auto"
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

                        {/* Action Buttons */}
                        {!isProcessed && (
                            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-wrap">
                                <button
                                    onClick={handleDecline}
                                    disabled={isProcessing}
                                    className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Decline & Dismiss
                                </button>
                                <button
                                    onClick={handleAccept}
                                    disabled={isProcessing}
                                    className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    {isProcessing ? 'Processing...' : 'Accept & Add to Archive'}
                                </button>
                            </div>
                        )}

                    </div>
                </div>

            </div>
        </div>
    );
}
