import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Image as ImageIcon, Calendar, MapPin, Users, FolderOpen, Edit, Trash2, Share, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [collection, setCollection] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareRecipient, setShareRecipient] = useState('');
  const [shareOptions, setShareOptions] = useState({ includeBio: false, includeContext: false });
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleShare = async (e) => {
    e.preventDefault();
    if (!shareRecipient) return;

    setIsSharing(true);
    setShareError(null);
    setShareSuccess(false);

    try {
      const { error: insertError } = await supabase
        .from('shares')
        .insert([{
          sender_id: user?.id,
          recipient_email: shareRecipient,
          collection_id: collection.id,
          include_bio: shareOptions.includeBio,
          include_context: shareOptions.includeContext,
          status: 'pending'
        }]);

      if (insertError) throw insertError;

      setShareSuccess(true);
      setTimeout(() => {
        setShowShareModal(false);
        setShareOptions({ includeBio: false, includeContext: false });
        setShareRecipient('');
        setShareSuccess(false);
      }, 2000);

    } catch (err) {
      console.error("Share error:", err);
      setShareError(err.message || 'Error executing share.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this collection? The artifacts inside it will remain safely in your main archive.")) {
      return;
    }

    try {
      setLoading(true);
      const { error: deleteError } = await supabase
        .from('collections')
        .delete()
        .eq('id', collection.id);

      if (deleteError) throw deleteError;

      navigate('/collections');
    } catch (err) {
      console.error("Error deleting collection:", err);
      alert("Failed to delete collection: " + err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Collection Metadata
        const { data: collData, error: collError } = await supabase
          .from('collections')
          .select('*')
          .eq('id', id)
          .single();

        if (collError) throw collError;
        setCollection(collData);

        // 2. Fetch Linked Memories via Junction Table
        const { data: edgeData, error: edgeError } = await supabase
          .from('memory_collections')
          .select(`
            memories (
              id,
              title,
              start_date,
              date_text,
              type,
              artifact_url,
              memory_persons ( persons ( display_name ) ),
              memory_places ( places ( placename, city_town, state_region, country ) )
            )
          `)
          .eq('collection_id', id);

        if (edgeError) throw edgeError;

        // Flatten the data for the grid
        const formattedMemories = (edgeData || []).map(edge => {
          const m = edge.memories;
          if (!m) return null;

          const people = m.memory_persons?.map(mp => mp.persons?.display_name).filter(Boolean) || [];
          const formatPlace = (p) => {
            if (!p) return null;
            const parts = [p.placename, p.city_town, p.state_region, p.country].filter(Boolean);
            return [...new Set(parts)].join(', ');
          };
          const places = m.memory_places?.map(mp => formatPlace(mp.places)).filter(Boolean) || [];

          return {
            id: m.id,
            title: m.title,
            date: m.date_text || (m.start_date ? m.start_date.split('-')[0] : ''),
            type: m.type,
            location: places.length > 0 ? places.join(', ') : 'Unknown Location',
            people: people,
            hasPhoto: m.artifact_url || null
          };
        }).filter(Boolean);

        setMemories(formattedMemories);

      } catch (err) {
        console.error("Error loading collection detail:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sepia-800"></div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="bg-red-50 text-red-800 p-8 rounded-xl border border-red-200 text-center max-w-2xl mx-auto mt-12">
        <h2 className="text-xl font-bold mb-2">Error Loading Collection</h2>
        <p>{error || "Collection not found."}</p>
        <button onClick={() => navigate('/collections')} className="mt-4 px-6 py-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors font-medium">Back to Collections Hub</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Share Collection Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-sepia-950/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper)] rounded-2xl border border-sepia-200 shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-sepia-100 bg-sepia-50/50 rounded-t-2xl">
              <h3 className="font-serif font-bold text-lg md:text-xl text-sepia-900 flex items-center gap-2">
                <Share size={20} className="text-blue-600" /> Share Collection
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-sepia-400 hover:text-sepia-700">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleShare} className="p-6 space-y-5 text-left">
              {shareError && <div className="text-red-700 bg-red-50 p-3 rounded-lg text-sm border border-red-200">{shareError}</div>}
              {shareSuccess ? (
                <div className="text-green-700 bg-green-50 p-4 rounded-xl text-center border border-green-200 space-y-2">
                  <Check className="mx-auto w-8 h-8 text-green-600" />
                  <p className="font-bold">Share Sent Successfully!</p>
                  <p className="text-sm">The recipient will see this collection in their inbox.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-sepia-800">Recipient Email Address *</label>
                    <input
                      required
                      type="email"
                      value={shareRecipient}
                      onChange={e => setShareRecipient(e.target.value)}
                      placeholder="e.g. user@example.com"
                      className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-3 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400"
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="text-sm font-semibold text-sepia-800 border-b border-sepia-100 pb-1 block">Collection Contents</label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-sepia-50 rounded-lg border border-transparent hover:border-sepia-200 transition-colors">
                      <input type="checkbox" checked={true} disabled className="w-4 h-4 text-sepia-600 rounded bg-sepia-200 border-transparent focus:ring-0 cursor-not-allowed opacity-50" />
                      <span className="text-sm font-medium text-sepia-900 opacity-60">All Artifacts ({memories.length} items)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-sepia-50 rounded-lg border border-transparent hover:border-sepia-200 transition-colors">
                      <input
                        type="checkbox"
                        checked={shareOptions.includeContext}
                        onChange={e => setShareOptions({ ...shareOptions, includeContext: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-sepia-300 rounded focus:ring-blue-600"
                      />
                      <span className="text-sm font-medium text-sepia-900">Context, Transcription & Dates</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-sepia-50 rounded-lg border border-transparent hover:border-sepia-200 transition-colors">
                      <input
                        type="checkbox"
                        checked={shareOptions.includeBio}
                        onChange={e => setShareOptions({ ...shareOptions, includeBio: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-sepia-300 rounded focus:ring-blue-600"
                      />
                      <span className="text-sm font-medium text-sepia-900">Linked Biographies & Tags</span>
                    </label>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 mt-4 border-t border-sepia-100">
                    <button type="button" onClick={() => setShowShareModal(false)} className="px-5 py-2.5 text-sepia-700 font-medium hover:bg-sepia-100 rounded-lg transition-colors">Cancel</button>
                    <button type="submit" disabled={isSharing || !shareRecipient || memories.length === 0} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                      {isSharing ? 'Sending...' : 'Send to Inbox'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Header Profile Area (Matches Pattern from PersonDetail) */}
      <div className="bg-[var(--color-paper)] border border-sepia-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center relative shadow-sm overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sepia-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="w-24 h-24 md:w-32 md:h-32 bg-sepia-100 border border-sepia-200 rounded-2xl flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative group">
          <FolderOpen size={48} className="text-sepia-400 group-hover:scale-110 transition-transform duration-500" />
        </div>

        <div className="flex-1 space-y-3 relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-sepia-900 leading-tight">
                {collection.name}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm font-medium text-sepia-600">
                <span className="flex items-center gap-1.5"><ImageIcon size={16} className="text-sepia-400" /> {memories.length} Artifacts</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowShareModal(true)} className="p-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200" title="Share Collection">
                <Share size={18} />
              </button>
              {/* Placeholders for future edit/delete tools on the collection itself */}
              <button className="p-2 text-sepia-500 hover:text-sepia-900 bg-sepia-100 hover:bg-sepia-200 rounded-lg transition-colors" title="Edit Collection Details">
                <Edit size={18} />
              </button>
              <button onClick={handleDelete} className="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors" title="Delete Collection">
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <p className="text-sepia-700 max-w-3xl leading-relaxed">
            {collection.description || <span className="italic text-sepia-400">No description provided.</span>}
          </p>
        </div>
      </div>

      {/* Detail Toolbar */}
      <div className="flex items-center justify-between py-2 border-b border-sepia-200">
        <h3 className="font-serif font-bold text-xl text-sepia-900">Collection Artifacts</h3>
        <button onClick={() => navigate('/archives')} className="text-sm font-medium text-sepia-600 hover:text-sepia-900 flex items-center gap-2">
          <ArrowLeft size={16} /> Add more from Archive
        </button>
      </div>

      {/* Grid Copy from Memories.jsx */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {memories.length === 0 ? (
          <div className="col-span-full p-12 text-center text-sepia-500 bg-[var(--color-paper)] rounded-xl border border-dashed border-sepia-300">
            <ImageIcon size={48} className="mx-auto mb-4 text-sepia-300" />
            <h3 className="text-xl font-medium text-sepia-900 mb-2">No Artifacts Here Yet</h3>
            <p>Go to your main Archive grid to tag items into this collection.</p>
          </div>
        ) : (
          memories.map(memory => (
            <div key={memory.id} onClick={() => navigate(`/memories/${memory.id}`)} className="group cursor-pointer flex flex-col bg-white border border-gray-200 p-3 shadow-md hover:shadow-xl transition-all duration-300 relative transform hover:-translate-y-1 hover:rotate-1">
              <div className="aspect-[4/3] bg-sepia-100/50 relative flex items-center justify-center overflow-hidden border border-gray-100">
                {memory.hasPhoto ? (
                  <img src={memory.hasPhoto} alt={memory.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <ImageIcon size={32} className="text-sepia-300" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-sepia-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-white text-xs font-semibold tracking-wider uppercase bg-sepia-900/30 backdrop-blur-md px-2.5 py-1 rounded shadow-sm">{memory.type}</span>
                </div>
              </div>

              {/* Polaroid Writable Space */}
              <div className="p-4 flex-1 flex flex-col bg-white">
                <h3 className="text-lg font-bold text-gray-800 mb-4 font-serif line-clamp-2 leading-tight group-hover:text-sepia-700 transition-colors">{memory.title}</h3>
                <div className="mt-auto space-y-2 text-sm font-medium text-gray-500">
                  <div className="flex items-center gap-2.5">
                    <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{memory.date}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{memory.location}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Users size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{memory.people.length > 0 ? memory.people.join(', ') : 'No people tagged'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
