import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Users, Calendar, MapPin, Search, AlertCircle, Image as ImageIcon, CheckCircle2, FolderOpen, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Memories() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth(); // Import user for filtering

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Batch Selection State
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Collections State for Batch Assignment
  const [availableCollections, setAvailableCollections] = useState([]);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);



  useEffect(() => {
    async function fetchCollections() {
      if (!supabase) return;
      const { data } = await supabase.from('collections').select('id, name').eq('owner_id', user?.id).order('name');
      if (data) setAvailableCollections(data);
    }
    fetchCollections();
  }, [user]);

  useEffect(() => {
    async function fetchMemories() {
      try {
        setLoading(true);
        if (!supabase) throw new Error("Supabase client not initialized.");

        // Fetch memories and traverse the graph to get linked entities
        const { data, error: fetchError } = await supabase
          .from('memories')
          .select(`
            id,
            title,
            start_date,
            date_text,
            description,
            type,
            artifact_url,
            memory_persons ( persons ( display_name ) ),
            memory_places ( places ( placename, city_town, state_region, country ) ),
            memory_events ( events ( name ) )
          `)
          .eq('uploader_id', user?.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        // Map the deep relational structure into a flat object for the UI
        const formattedMemories = (data || []).map(m => {

          const people = m.memory_persons?.map(mp => mp.persons?.display_name).filter(Boolean) || [];

          const formatPlace = (p) => {
            if (!p) return null;
            const parts = [p.placename, p.city_town, p.state_region, p.country].filter(Boolean);
            return [...new Set(parts)].join(', ');
          };
          const places = m.memory_places?.map(mp => formatPlace(mp.places)).filter(Boolean) || [];
          // We can also extract events similarly if desired

          return {
            id: m.id,
            title: m.title,
            date: m.date_text || (m.start_date ? m.start_date.split('-')[0] : ''),
            description: m.description || '',
            type: m.type,
            location: places.length > 0 ? places.join(', ') : 'Unknown Location',
            people: people,
            hasPhoto: m.artifact_url || null
          };
        });

        setMemories(formattedMemories);
      } catch (err) {
        console.error("Error fetching memories:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMemories();
  }, []);

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectMode(false);
  };

  const handleCardClick = (id) => {
    if (selectMode) {
      const newSelected = new Set(selectedItems);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedItems(newSelected);
    } else {
      navigate(`/memories/${id}`);
    }
  };

  const handleBatchAssign = async () => {
    if (selectedItems.size === 0) return;
    if (!selectedCollectionId) return;
    if (selectedCollectionId === 'CREATE_NEW' && !newCollectionName.trim()) {
      alert("Please enter a name for the new collection.");
      return;
    }

    setIsAssigning(true);

    try {
      let targetCollectionId = selectedCollectionId;

      if (selectedCollectionId === 'CREATE_NEW') {
        // Create new collection
        const { data: newColl, error: collError } = await supabase
          .from('collections')
          .insert([{ name: newCollectionName.trim(), owner_id: user?.id }])
          .select()
          .single();

        if (collError) throw collError;
        targetCollectionId = newColl.id;

        // Optionally, append to availableCollections in state so it shows next time without refresh
        setAvailableCollections(prev => [...prev, { id: newColl.id, name: newColl.name }].sort((a,b) => a.name.localeCompare(b.name)));
      }

      // Create edge objects for bulk insert
      const edgesToInsert = Array.from(selectedItems).map(memoryId => ({
        memory_id: memoryId,
        collection_id: targetCollectionId
      }));

      // In real-world, we'd want to ON CONFLICT DO NOTHING, but Supabase JS doesn't expose it cleanly without specifying unique constraints directly.
      // Since it's a junction table without a unique constraint on (memory_id, collection_id) in our current schema, duplicates could happen.
      // To be strictly safe, we delete existing matching pairs first, then insert.

      const { error: delError } = await supabase
        .from('memory_collections')
        .delete()
        .eq('collection_id', targetCollectionId)
        .in('memory_id', Array.from(selectedItems));

      if (delError) throw delError;

      const { error: insError } = await supabase
        .from('memory_collections')
        .insert(edgesToInsert);

      if (insError) throw insError;

      // Reset & close
      setShowCollectionModal(false);
      setNewCollectionName('');
      clearSelection();

      // Optional: Show success toast
      alert(`Successfully added ${selectedItems.size} items to the collection!`);

    } catch (err) {
      console.error("Batch assignment error", err);
      alert("Failed to assign to collection.");
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredMemories = memories.filter(memory => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    return (
      (memory.title && memory.title.toLowerCase().includes(query)) ||
      (memory.description && memory.description.toLowerCase().includes(query)) ||
      (memory.location && memory.location.toLowerCase().includes(query)) ||
      (memory.people && memory.people.some(p => p.toLowerCase().includes(query))) ||
      (memory.type && memory.type.toLowerCase().includes(query)) ||
      (memory.date && memory.date.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">

      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="font-medium">Connection Error: {error}</p>
        </div>
      )}

      {/* Controls Bar */}
      <div className="sticky top-16 lg:top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-paper)] p-4 rounded-xl border border-sepia-200 shadow-sm mt-0 lg:mt-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia-500" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artifacts by title, person, or context..."
            className="w-full pl-10 pr-4 py-2 bg-sepia-50 border border-sepia-300 rounded-lg text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 focus:border-transparent transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectMode(!selectMode);
              if (selectMode) setSelectedItems(new Set());
            }}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors font-medium ${selectMode
              ? 'bg-sepia-800 text-sepia-50 border-sepia-900'
              : 'bg-sepia-100 text-sepia-800 border-sepia-300 hover:bg-sepia-200'
              }`}
          >
            <CheckCircle2 size={18} /> {selectMode ? 'Done' : 'Select'}
          </button>
          {!selectMode && (
            <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-sepia-100 text-sepia-800 border border-sepia-300 rounded-lg hover:bg-sepia-200 transition-colors font-medium">
              <Filter size={18} /> Filters
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          // Skeletons
          [1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col bg-sepia-50 border border-sepia-200 rounded-xl overflow-hidden animate-pulse min-h-[300px]">
              <div className="aspect-[4/3] bg-sepia-200"></div>
              <div className="p-5 flex-1 space-y-3">
                <div className="h-6 bg-sepia-200 rounded w-3/4"></div>
                <div className="h-4 bg-sepia-200 rounded w-1/2 mt-4"></div>
                <div className="h-4 bg-sepia-200 rounded w-2/3"></div>
              </div>
            </div>
          ))
        ) : filteredMemories.length === 0 ? (
          <div className="col-span-full p-12 text-center text-sepia-500 bg-[var(--color-paper)] rounded-xl border border-dashed border-sepia-300">
            <ImageIcon size={48} className="mx-auto mb-4 text-sepia-300" />
            <h3 className="text-xl font-medium text-sepia-900 mb-2">No Results Found</h3>
            <p>{searchQuery ? `No artifacts match your search for "${searchQuery}".` : 'No memories have been uploaded or detected.'}</p>
          </div>
        ) : (
          filteredMemories.map(memory => {
            const isSelected = selectedItems.has(memory.id);
            return (
              <div
                key={memory.id}
                onClick={() => handleCardClick(memory.id)}
                className={`group cursor-pointer flex flex-col bg-white border border-gray-200 p-3 shadow-md hover:shadow-xl transition-all duration-300 relative transform hover:-translate-y-1 hover:rotate-1 ${isSelected ? 'ring-4 ring-sepia-600' : ''
                  }`}
              >
                {/* Selection Checkbox Overlay */}
                {selectMode && (
                  <div className="absolute top-4 right-4 z-20">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-sepia-800 border-sepia-800 text-white' : 'bg-white/80 border-sepia-400 backdrop-blur-sm shadow-sm'
                      }`}>
                      {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
                    </div>
                  </div>
                )}

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
            );
          })
        )}
      </div>

      {/* Floating Action Bar for Batch Selection */}
      {selectMode && selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5">
          <div className="bg-sepia-900 text-sepia-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-sepia-700 backdrop-blur-md">
            <span className="font-medium text-lg whitespace-nowrap">
              {selectedItems.size} Selected
            </span>
            <div className="w-px h-6 bg-sepia-700"></div>
            <button
              onClick={() => setShowCollectionModal(true)}
              className="flex items-center gap-2 bg-sepia-50 text-sepia-900 px-4 py-2 rounded-lg font-bold hover:bg-white transition-colors"
            >
              <FolderOpen size={18} />
              Add to Collection
            </button>
            <div className="w-px h-6 bg-sepia-700"></div>
            <button
              onClick={clearSelection}
              className="text-sepia-400 hover:text-white transition-colors"
              title="Clear Selection"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Batch Add to Collection Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-sepia-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper)] rounded-2xl border border-sepia-200 shadow-2xl w-full max-w-md flex flex-col max-h-[80vh] relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-sepia-200 bg-[var(--color-paper)] flex-shrink-0 relative z-10 shadow-sm">
              <h3 className="font-serif font-bold text-xl text-sepia-900">Add to Collection</h3>
              <button onClick={() => setShowCollectionModal(false)} className="text-sepia-400 hover:text-sepia-700">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto flex-1 relative z-0">
              <p className="text-sepia-600 mb-4 font-medium">Add {selectedItems.size} artifact(s) to:</p>

              <div className="space-y-3">
                <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors overflow-hidden ${selectedCollectionId === 'CREATE_NEW' ? 'border-primary bg-primary/5' : 'border-sepia-200 hover:bg-sepia-50'
                  }`}>
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-primary flex items-center gap-2">
                      <FolderOpen size={16} />
                      Create New Collection
                    </span>
                    <input
                      type="radio"
                      name="collection_target"
                      value="CREATE_NEW"
                      checked={selectedCollectionId === 'CREATE_NEW'}
                      onChange={() => setSelectedCollectionId('CREATE_NEW')}
                      className="w-4 h-4 text-primary border-sepia-300 focus:ring-primary"
                    />
                  </div>
                  
                  {/* Expandable Text Input */}
                  <div className={`mt-3 transition-all duration-300 ${selectedCollectionId === 'CREATE_NEW' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 hidden'}`}>
                    <input 
                      type="text" 
                      placeholder="e.g. 1999 Grand Canyon Trip"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      className="w-full px-3 py-2 border border-sepia-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-sepia-900"
                      onClick={(e) => {
                         // Prevent clicking the input from toggling the radio if it's already selected
                         e.stopPropagation(); 
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleBatchAssign();
                        }
                      }}
                    />
                  </div>
                </label>

                <div className="flex items-center gap-3 my-4">
                  <div className="h-px bg-sepia-200 flex-1"></div>
                  <span className="text-xs font-semibold uppercase text-sepia-400 tracking-wider">OR CHOOSE EXISTING</span>
                  <div className="h-px bg-sepia-200 flex-1"></div>
                </div>

                {availableCollections.map(collection => (
                  <label key={collection.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selectedCollectionId === collection.id ? 'border-sepia-800 bg-sepia-100' : 'border-sepia-200 hover:bg-sepia-50'
                    }`}>
                    <span className="font-medium text-sepia-900 flex items-center gap-2">
                      <FolderOpen size={16} className={selectedCollectionId === collection.id ? 'text-sepia-800' : 'text-sepia-400'} />
                      {collection.name}
                    </span>
                    <input
                      type="radio"
                      name="collection_target"
                      value={collection.id}
                      checked={selectedCollectionId === collection.id}
                      onChange={() => setSelectedCollectionId(collection.id)}
                      className="w-4 h-4 text-sepia-800 border-sepia-300 focus:ring-sepia-800"
                    />
                  </label>
                ))}

                {availableCollections.length === 0 && (
                  <div className="text-center p-4 bg-sepia-50 rounded-lg text-sepia-500 border border-dashed border-sepia-300">
                    No existing collections. Try creating one above!
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 md:p-6 border-t border-sepia-200 bg-[var(--color-paper)] flex flex-row items-center justify-end gap-4 relative z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
              <button
                type="button"
                onClick={() => setShowCollectionModal(false)}
                className="px-4 py-2 font-medium text-sepia-700 hover:bg-sepia-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchAssign}
                disabled={!selectedCollectionId || isAssigning}
                className="px-6 py-2 font-bold bg-sepia-800 text-sepia-50 rounded-lg hover:bg-sepia-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 min-w-[100px]"
              >
                {isAssigning ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
