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
              memory_persons ( role, person_id, persons ( id, display_name ) )
            ),
            collections (
              *,
              memory_collections (
                memories (
                  *,
                  memory_persons ( role, person_id, persons ( id, display_name ) )
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

            } catch (err) {
                console.error("Error fetching share:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchShare();
    }, [id, user]);

    const handleAccept = async () => {
        if (!share) return;
        setIsProcessing(true);

        try {
            const { error: updateError } = await supabase
                .from('shares')
                .update({ status: 'accepted' })
                .eq('id', share.id);
            
            if (updateError) throw updateError;

            // Route to read-only views
            if (share.collection_id) {
                navigate(`/shared/collection/${share.collection_id}`);
            } else {
                // Future Implementation: A Read-Only Memory View
                navigate(`/shared/memory/${share.memory_id}`);
            }

        } catch (err) {
            console.error("Error accepting share:", err);
            alert("Failed to accept share: " + err.message);
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

                        {/* Bio Tag Resolution Block removed: Mapping now happens during Selective Import */}

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
