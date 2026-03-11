import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Image as ImageIcon, Calendar, MapPin, Users, FolderOpen, CheckCircle2, DownloadCloud } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SharedCollection() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [collection, setCollection] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Batch Selection State
  const [selectedItems, setSelectedItems] = useState(new Set());

  const toggleSelection = (e, memId) => {
    e.stopPropagation();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(memId)) {
      newSelected.delete(memId);
    } else {
      newSelected.add(memId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === memories.length) {
      setSelectedItems(new Set()); // Deselect all
    } else {
      setSelectedItems(new Set(memories.map(m => m.id))); // Select all
    }
  };

  const handleImportSelected = () => {
    if (selectedItems.size === 0) return;
    
    // Convert Set to comma separated string or array to pass via URL state
    const selectedIds = Array.from(selectedItems).join(',');
    
    // We navigate to a specialized import review screen (which we will repurpose ShareReview.jsx for)
    // Passing the collection id and the selected memory ids so it knows what to clone.
    navigate(`/shared/import/${id}?memories=${selectedIds}`);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Collection Metadata (We have read access due to the accepted share RLS policy)
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
        console.error("Error loading shared collection:", err);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan"></div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="bg-red-50 text-red-800 p-8 rounded-xl border border-red-200 text-center max-w-2xl mx-auto mt-12">
        <h2 className="text-xl font-bold mb-2">Error Loading Shared Collection</h2>
        <p>{error || "Collection not found. The sender may have deleted it or revoked access."}</p>
        <button onClick={() => navigate('/dashboard')} className="mt-4 px-6 py-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors font-medium">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      
      {/* Header Profile Area (Matches Pattern from PersonDetail) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center relative shadow-sm overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-cyan/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative group">
          <FolderOpen size={48} className="text-accent-cyan group-hover:scale-110 transition-transform duration-500" />
        </div>

        <div className="flex-1 space-y-3 relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan text-[10px] uppercase font-bold rounded tracking-wider">Shared With You (Read-Only)</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-white leading-tight">
                {collection.name}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm font-medium text-slate-400">
                <span className="flex items-center gap-1.5"><ImageIcon size={16} className="text-slate-500" /> {memories.length} Artifacts</span>
              </div>
            </div>
          </div>

          <p className="text-slate-300 max-w-3xl leading-relaxed">
            {collection.description || <span className="italic text-slate-500">No description provided.</span>}
          </p>
        </div>
      </div>

      {/* Detail Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-slate-100">Browse Contents</h3>
          <p className="text-sm text-slate-500">Select the artifacts you wish to copy into your personal archive.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSelectAll} 
            className="px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            {selectedItems.size === memories.length ? 'Deselect All' : 'Select All'}
          </button>
          <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-2">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      {/* Selectable Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {memories.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <ImageIcon size={48} className="mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300 mb-2">Empty Collection</h3>
            <p>The sender hasn't added any artifacts to this collection yet.</p>
          </div>
        ) : (
          memories.map(memory => {
            const isSelected = selectedItems.has(memory.id);
            return (
              <div 
                key={memory.id} 
                onClick={(e) => toggleSelection(e, memory.id)} 
                className={`group cursor-pointer flex flex-col bg-white dark:bg-slate-900 border p-3 shadow-sm hover:shadow-xl transition-all duration-300 relative transform hover:-translate-y-1 ${isSelected ? 'border-accent-cyan ring-2 ring-accent-cyan/50' : 'border-slate-200 dark:border-slate-800'}`}
              >
                {/* Selection Checkbox Overlay */}
                <div className="absolute top-4 right-4 z-20">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-accent-cyan border-accent-cyan text-slate-900' : 'bg-black/40 border-white/60 backdrop-blur-sm shadow-sm'}`}>
                    {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
                  </div>
                </div>

                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700/50">
                  {memory.hasPhoto ? (
                    <img src={memory.hasPhoto} alt={memory.title} className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`} />
                  ) : (
                    <ImageIcon size={32} className="text-slate-400" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 flex items-end p-4 pointer-events-none">
                    <span className="text-white text-xs font-semibold tracking-wider uppercase backdrop-blur-sm">{memory.type}</span>
                  </div>
                </div>

                {/* Polaroid Writable Space */}
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 font-serif line-clamp-2 leading-tight group-hover:text-accent-cyan transition-colors">{memory.title}</h3>
                  <div className="mt-auto space-y-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2.5">
                      <Calendar size={14} className="flex-shrink-0" />
                      <span className="truncate">{memory.date}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin size={14} className="flex-shrink-0" />
                      <span className="truncate">{memory.location}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Users size={14} className="flex-shrink-0" />
                      <span className="truncate">{memory.people.length > 0 ? memory.people.join(', ') : 'No people tagged'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Bar for Import */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-slate-100 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-700 backdrop-blur-md">
            <span className="font-medium text-lg whitespace-nowrap">
              <span className="text-accent-cyan font-bold">{selectedItems.size}</span> Selected
            </span>
            <div className="w-px h-6 bg-slate-700"></div>
            <button
              onClick={handleImportSelected}
              className="flex items-center gap-2 bg-accent-cyan text-slate-900 px-6 py-2 rounded-lg font-bold hover:bg-accent-cyan/90 transition-colors shadow-lg"
            >
              <DownloadCloud size={18} />
              Import to Archive
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
