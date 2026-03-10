import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, FolderOpen, Image as ImageIcon, FileText, Search, MoreVertical, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Collections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: '', description: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch collections and a count of how many memories are linked
      const { data, error: fetchError } = await supabase
        .from('collections')
        .select(`
          id,
          name,
          description,
          created_at,
          memory_collections (
            memories (
              artifact_url,
              thumbnail_url
            )
          )
        `)
        .order('name');

      if (fetchError) throw fetchError;

      // Format counts and extract a random image per collection
      const formatted = (data || []).map(c => {
        const memoryEdges = c.memory_collections || [];
        const memories = memoryEdges.map(mc => mc.memories).filter(Boolean);
        const validImages = memories.filter(m => m.artifact_url || m.thumbnail_url).map(m => m.thumbnail_url || m.artifact_url);
        const randomImage = validImages.length > 0 ? validImages[Math.floor(Math.random() * validImages.length)] : null;

        return {
          ...c,
          itemCount: memoryEdges.length,
          randomImage
        };
      });

      setCollections(formatted);
    } catch (err) {
      console.error("Error fetching collections:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCollection.name.trim()) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const { error: insertError } = await supabase
        .from('collections')
        .insert([{
          name: newCollection.name.trim(),
          description: newCollection.description.trim() || null
        }]);

      if (insertError) throw insertError;

      setNewCollection({ name: '', description: '' });
      setShowCreateModal(false);
      await fetchCollections();
    } catch (err) {
      console.error("Creation error:", err);
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-sepia-900 tracking-tight">Archive Collections</h1>
          <p className="text-sepia-600 mt-1">Organize your artifacts into thematic groups and sub-archives.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 bg-sepia-800 text-sepia-50 px-5 py-2.5 rounded-lg font-medium hover:bg-sepia-900 transition-colors shadow-sm"
        >
          <Plus size={18} /> Create Collection
        </button>
      </div>

      {/* Controls Bar */}
      <div className="sticky top-16 lg:top-0 z-20 flex flex-col sm:flex-row gap-4 bg-[var(--color-paper)] p-4 rounded-xl border border-sepia-200 shadow-sm mt-0 lg:mt-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia-500" size={18} />
          <input
            type="text"
            placeholder="Search collections..."
            className="w-full pl-10 pr-4 py-2 bg-sepia-50 border border-sepia-300 rounded-lg text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 focus:border-transparent transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200">
          <p className="font-medium">Error loading collections: {error}</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          // Skeletons
          [1, 2, 3].map(i => (
            <div key={i} className="bg-sepia-50 border border-sepia-200 rounded-xl p-6 animate-pulse h-48"></div>
          ))
        ) : collections.length === 0 ? (
          <div className="col-span-full p-12 text-center text-sepia-500 bg-[var(--color-paper)] rounded-xl border border-dashed border-sepia-300">
            <FolderOpen size={48} className="mx-auto mb-4 text-sepia-300" />
            <h3 className="text-xl font-medium text-sepia-900 mb-2">No Collections Yet</h3>
            <p>Create your first collection to start organizing artifacts.</p>
          </div>
        ) : (
          collections.map(collection => (
            <div
              key={collection.id}
              // onClick={() => navigate(`/collections/${collection.id}`)} // Future detail page
              className="group cursor-pointer flex flex-col bg-[var(--color-paper)] border border-sepia-200 rounded-xl p-6 hover:border-sepia-400 hover:shadow-md transition-all relative overflow-hidden"
            >
              {collection.randomImage ? (
                <div className="h-40 -mx-6 -mt-6 mb-4 relative overflow-hidden bg-sepia-100">
                  <img src={collection.randomImage} alt={collection.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"></div>
                  <button className="absolute top-3 right-3 text-white/90 hover:text-white p-1 drop-shadow-md z-10 transition-colors">
                    <MoreVertical size={18} />
                  </button>
                  <div className="absolute bottom-3 left-4 p-2 bg-[var(--color-paper)]/90 backdrop-blur-sm text-sepia-700 rounded-lg shadow-sm border border-white/20">
                    <FolderOpen size={20} />
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-sepia-100 text-sepia-700 rounded-lg group-hover:bg-sepia-800 group-hover:text-sepia-50 transition-colors">
                    <FolderOpen size={24} />
                  </div>
                  <button className="text-sepia-400 hover:text-sepia-700 p-1">
                    <MoreVertical size={18} />
                  </button>
                </div>
              )}
              <h3 className="text-xl md:text-2xl font-bold font-serif text-sepia-900 leading-tight mb-2 group-hover:text-sepia-700 transition-colors">
                {collection.name}
              </h3>
              <p className="text-sepia-600 text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-4 leading-relaxed">
                {collection.description || 'No description provided.'}
              </p>
              <div className="mt-auto pt-4 border-t border-sepia-100 flex items-center justify-between text-sm font-medium text-sepia-600">
                <span className="flex items-center gap-1.5"><ImageIcon size={16} className="text-sepia-400" /> {collection.itemCount} {collection.itemCount === 1 ? 'Artifact' : 'Artifacts'}</span>
                <button
                  onClick={() => navigate(`/collections/${collection.id}`)}
                  className="text-primary hover:text-sepia-900 transition-colors flex items-center gap-1"
                >
                  View Items &rarr;
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-sepia-950/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper)] rounded-2xl border border-sepia-200 shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-sepia-100 bg-sepia-50/50 rounded-t-2xl">
              <h3 className="font-serif font-bold text-xl text-sepia-900">Create New Collection</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-sepia-400 hover:text-sepia-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createError && <p className="text-red-600 text-sm">{createError}</p>}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-sepia-800">Collection Name *</label>
                <input
                  required
                  autoFocus
                  value={newCollection.name}
                  onChange={e => setNewCollection({ ...newCollection, name: e.target.value })}
                  type="text"
                  className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-3 text-sepia-900 font-medium focus:outline-none focus:ring-2 focus:ring-sepia-400"
                  placeholder="e.g. WWII Letters, 1980s Photos"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-sepia-800">Description</label>
                <textarea
                  value={newCollection.description}
                  onChange={e => setNewCollection({ ...newCollection, description: e.target.value })}
                  className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-3 text-sepia-900 h-24 focus:outline-none focus:ring-2 focus:ring-sepia-400 resize-none"
                  placeholder="Optional context about this group of artifacts..."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-sepia-700 font-medium hover:bg-sepia-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isCreating || !newCollection.name.trim()} className="bg-sepia-800 text-sepia-50 px-6 py-2.5 rounded-lg font-medium hover:bg-sepia-900 transition-colors disabled:opacity-50">
                  {isCreating ? 'Creating...' : 'Create Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
