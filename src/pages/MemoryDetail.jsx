import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Trash2, ZoomIn, ZoomOut, Download, AlertCircle, Edit2, Check, X, MapPin, Tag, Users, Clock, ImageIcon, Lock } from 'lucide-react';
import DateRangePicker from '../components/DateRangePicker';
import PlacePicker from '../components/PlacePicker';
import ImageZoomModal from '../components/ImageZoomModal';

export default function MemoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Image Zoom State
  const [showImageModal, setShowImageModal] = useState(false);

  const openImageModal = (e) => {
    if (e) e.stopPropagation();
    setShowImageModal(true);
  };

  // Available People for Tagging
  const [availablePeople, setAvailablePeople] = useState([]);
  
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch Memory Data + existing Memory_Persons
        const { data: memData, error: memError } = await supabase
          .from('memories')
          .select(`
            id,
            title,
            start_date,
            end_date,
            date_text,
            description,
            type,
            artifact_url,
            memory_persons ( person_id, role ),
            memory_places ( place_id )
          `)
          .eq('id', id)
          .single();
          
        if (memError) throw memError;
        
        // Map edges into objects storing ID and Role
        const initialTaggedPeople = memData.memory_persons?.map(mp => ({
          id: mp.person_id,
          role: mp.role || 'subject'
        })) || [];
        
        setMemory({
          ...memData,
          date: { 
            startDate: memData.start_date || null, 
            endDate: memData.end_date || null, 
            dateText: memData.date_text || null 
          },
          description: memData.description || '',
          taggedPeople: initialTaggedPeople,
          taggedPlaces: memData.memory_places?.map(mp => mp.place_id) || []
        });
        
        // 2. Fetch all available persons for the tagging UI
        await fetchPeople();
        
      } catch (err) {
        console.error("Error fetching detail:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [id]);

  const fetchPeople = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('persons').select('id, display_name').order('created_at', { ascending: false });
    if (data) setAvailablePeople(data);
  };

  // Add Person Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPerson, setNewPerson] = useState({ 
    display_name: '', first_name: '', last_name: '', 
    birth: { startDate: null, endDate: null, dateText: null }, 
    death: { startDate: null, endDate: null, dateText: null },
    isDeceased: false
  });
  const [addingError, setAddingError] = useState(null);
  const [isAddingPerson, setIsAddingPerson] = useState(false);

  const handleAddPerson = async (e) => {
    e.preventDefault();
    setIsAddingPerson(true);
    setAddingError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('persons')
        .insert([{
          display_name: newPerson.display_name,
          first_name: newPerson.first_name || null,
          last_name: newPerson.last_name || null,
          birth_start_date: newPerson.birth.startDate || null,
          birth_end_date: newPerson.birth.endDate || null,
          birth_text: newPerson.birth.dateText || null,
          death_start_date: newPerson.death.startDate || null,
          death_end_date: newPerson.death.endDate || null,
          death_text: newPerson.death.dateText || null
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Auto-tag the newly created person as a subject
      setMemory(prev => ({
        ...prev,
        taggedPeople: [...prev.taggedPeople, { id: data.id, role: 'subject' }]
      }));
      
      // Reset and reload
      setShowAddModal(false);
      setNewPerson({ display_name: '', first_name: '', last_name: '', birth: { startDate: null, endDate: null, dateText: null }, death: { startDate: null, endDate: null, dateText: null }, isDeceased: false });
      await fetchPeople();
    } catch (err) {
      console.error("Error adding person:", err);
      setAddingError(err.message);
    } finally {
      setIsAddingPerson(false);
    }
  };

  const togglePersonTag = (personId) => {
    setMemory(prev => {
      const isTagged = prev.taggedPeople.some(p => p.id === personId);
      if (isTagged) {
        return { ...prev, taggedPeople: prev.taggedPeople.filter(p => p.id !== personId) };
      } else {
        return { ...prev, taggedPeople: [...prev.taggedPeople, { id: personId, role: 'subject' }] };
      }
    });
  };

  const updatePersonRole = (personId, newRole) => {
    setMemory(prev => ({
      ...prev,
      taggedPeople: prev.taggedPeople.map(p => 
        p.id === personId ? { ...p, role: newRole } : p
      )
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Update Core Memory Record
      const { error: updateError } = await supabase
        .from('memories')
        .update({
          title: memory.title,
          type: memory.type,
          start_date: memory.date?.startDate || null,
          end_date: memory.date?.endDate || null,
          date_text: memory.date?.dateText || null,
          description: memory.description
        })
        .eq('id', memory.id);
        
      if (updateError) throw updateError;
      
      // 2. Synchronize memory_persons tags 
      // Easiest approach for MVP sync: delete all edges for memory, re-insert selected
      const { error: deleteEdgesError } = await supabase
        .from('memory_persons')
        .delete()
        .eq('memory_id', memory.id);
        
      if (deleteEdgesError) throw deleteEdgesError;
      
      // Prevent duplicates by ID just in case
      const uniqueTagged = Array.from(new Map(memory.taggedPeople.map(item => [item.id, item])).values());
      
      if (uniqueTagged.length > 0) {
        const edges = uniqueTagged.map(person => ({
          memory_id: memory.id,
          person_id: person.id,
          role: person.role
        }));
        
        const { error: insertEdgesError } = await supabase
          .from('memory_persons')
          .insert(edges);
          
        if (insertEdgesError) throw insertEdgesError;
      }
      
      // 3. Synchronize memory_places tags
      const { error: deletePlacesError } = await supabase
        .from('memory_places')
        .delete()
        .eq('memory_id', memory.id);
        
      if (deletePlacesError) throw deletePlacesError;
      
      const uniquePlaces = Array.from(new Set(memory.taggedPlaces || []));
      if (uniquePlaces.length > 0) {
        const placeEdges = uniquePlaces.map(placeId => ({
          memory_id: memory.id,
          place_id: placeId
        }));
        
        const { error: insertPlacesError } = await supabase
          .from('memory_places')
          .insert(placeEdges);
          
        if (insertPlacesError) throw insertPlacesError;
      }
      
      navigate('/memories');
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save changes. " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this memory?")) return;
    
    try {
      const { error: deleteError } = await supabase
        .from('memories')
        .delete()
        .eq('id', memory.id);
        
      if (deleteError) throw deleteError;
      navigate('/memories');
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete memory.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sepia-800"></div>
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="p-8 text-center bg-red-50 text-red-800 rounded-xl border border-red-200">
        <p className="font-bold text-lg mb-2">Failed to load memory</p>
        <p>{error || 'Memory not found'}</p>
        <button onClick={() => navigate('/memories')} className="mt-4 px-4 py-2 bg-red-100 rounded-lg hover:bg-red-200">Return to Archive</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-500 relative">
      
      {/* Add Person Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-sepia-950/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper)] rounded-2xl border border-sepia-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-sepia-100 bg-sepia-50/50 sticky top-0 z-10">
              <h3 className="font-serif font-bold text-lg md:text-xl text-sepia-900">Add Person to Graph</h3>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)} 
                className="text-sepia-400 hover:text-sepia-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddPerson} className="p-6 space-y-4 text-left">
              {addingError && <p className="text-red-600 text-sm">{addingError}</p>}
              
              <div className="space-y-1">
                <label className="text-sm font-semibold text-sepia-800">Display Name *</label>
                <input required value={newPerson.display_name} onChange={e => setNewPerson({...newPerson, display_name: e.target.value})} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" placeholder="e.g. Grandma Rose" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-sepia-800">First Name</label>
                  <input value={newPerson.first_name} onChange={e => setNewPerson({...newPerson, first_name: e.target.value})} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-sepia-800">Last Name</label>
                  <input value={newPerson.last_name} onChange={e => setNewPerson({...newPerson, last_name: e.target.value})} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" />
                </div>
              </div>

              <DateRangePicker 
                label="Birth Date" 
                value={newPerson.birth} 
                onChange={(val) => setNewPerson({...newPerson, birth: val})} 
              />
              
              <label className="flex items-center gap-2 cursor-pointer mt-2 w-max">
                <input 
                  type="checkbox" 
                  checked={newPerson.isDeceased}
                  onChange={(e) => setNewPerson({...newPerson, isDeceased: e.target.checked})}
                  className="w-4 h-4 text-sepia-600 border-sepia-300 rounded focus:ring-sepia-500"
                />
                <span className="text-sm font-semibold text-sepia-800">Person is Deceased</span>
              </label>

              {newPerson.isDeceased && (
                <DateRangePicker 
                  label="Death Date" 
                  value={newPerson.death || { startDate: null, endDate: null, dateText: null }} 
                  onChange={(val) => setNewPerson({...newPerson, death: val})} 
                />
              )}
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-sepia-700 font-medium hover:bg-sepia-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isAddingPerson || !newPerson.display_name} className="flex items-center gap-2 bg-sepia-800 text-sepia-50 px-5 py-2.5 rounded-lg font-medium hover:bg-sepia-900 transition-colors disabled:opacity-50">
                  {isAddingPerson ? 'Adding...' : 'Create Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Screen Image Zoom & Pan Modal */}
      {showImageModal && memory.type === 'photo' && memory.artifact_url && (
        <ImageZoomModal 
          url={memory.artifact_url} 
          alt={memory.title} 
          onClose={() => setShowImageModal(false)} 
        />
      )}

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <button onClick={() => navigate('/memories')} className="w-full sm:w-auto flex items-center justify-center gap-2 text-sepia-600 hover:text-sepia-900 transition-colors font-medium bg-sepia-100/50 hover:bg-sepia-200 px-4 py-2 rounded-lg border border-sepia-200">
          <ArrowLeft size={18} /> <span className="hidden sm:inline">Back to Grid</span><span className="sm:hidden">Back</span>
        </button>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={handleDelete} className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg font-medium transition-colors border border-red-200">
            <Trash2 size={18} /> <span className="hidden sm:inline">Delete Artifact</span>
          </button>
          <button onClick={handleSave} disabled={isSaving} className="flex-[2] sm:flex-none flex items-center justify-center gap-2 bg-sepia-800 text-sepia-50 px-6 py-2 rounded-lg font-medium hover:bg-sepia-900 transition-colors disabled:opacity-50 whitespace-nowrap">
            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Updates'}
          </button>
        </div>
      </div>

      {/* Split View Container */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0 pb-12 lg:pb-0">
        
        {/* Left Column: Artifact Viewer */}
        <div className="flex-1 bg-[var(--color-paper)] border border-sepia-200 rounded-2xl overflow-hidden shadow-sm flex flex-col relative group">
           <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-sepia-950/40 to-transparent z-10 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="bg-sepia-900/60 backdrop-blur-md text-sepia-50 text-sm font-medium px-3 py-1 rounded-full border border-sepia-700/50 capitalize">
                {memory.type} node
              </span>
           </div>
           
           {memory.artifact_url ? (
             <div className="flex-1 w-full bg-sepia-100 flex items-center justify-center p-4 relative overflow-hidden group/img">
                {memory.type === 'photo' ? (
                  <>
                    <img src={memory.artifact_url} alt={memory.title} className="max-w-full max-h-full object-contain drop-shadow-md rounded z-0" />
                    <div 
                      onClick={openImageModal}
                      className="absolute inset-0 bg-sepia-900/10 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer z-10 flex items-center justify-center"
                    >
                      <div className="bg-sepia-900/60 text-sepia-50 p-4 rounded-full backdrop-blur-md shadow-lg transform scale-95 group-hover/img:scale-100 transition-transform">
                        <ZoomIn size={32} />
                      </div>
                    </div>
                  </>
                ) : (
                  <iframe src={memory.artifact_url} title={memory.title} className="w-full h-full bg-white rounded" />
                )}
             </div>
           ) : (
             <div className="flex-1 w-full bg-sepia-100 flex flex-col items-center justify-center text-sepia-400">
               <ImageIcon size={64} className="mb-4 text-sepia-300" />
               <p className="font-medium text-lg text-sepia-500">No media attached to this node</p>
             </div>
           )}
        </div>

        {/* Right Column: Metadata Editor */}
        <div className="w-full lg:w-[450px] flex flex-col gap-6 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-sepia-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          
          {/* Core Properties */}
          <div className="bg-[var(--color-paper)] border border-sepia-200 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="font-serif font-bold text-xl text-sepia-900 border-b border-sepia-100 pb-3">Node Data</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-sepia-800">Artifact Title</label>
                <input 
                  value={memory.title} 
                  onChange={e => setMemory({...memory, title: e.target.value})} 
                  type="text" 
                  className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 font-medium focus:outline-none focus:ring-2 focus:ring-sepia-400" 
                />
              </div>
              
              <DateRangePicker 
                label="Memory Date (Temporal Node)" 
                value={memory.date} 
                onChange={(val) => setMemory({...memory, date: val})} 
              />
              <div className="mt-6">
                 <PlacePicker 
                   selectedPlaceIds={memory.taggedPlaces || []}
                   onChange={(places) => setMemory({...memory, taggedPlaces: places})}
                 />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-sepia-800">Context / Story / Transcription</label>
                <textarea 
                  value={memory.description} 
                  onChange={e => setMemory({...memory, description: e.target.value})} 
                  className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-3 text-sepia-900 h-32 focus:outline-none focus:ring-2 focus:ring-sepia-400 resize-none" 
                  placeholder="Record OCR text or back-of-photo writing here..." 
                />
              </div>
            </div>
          </div>

          {/* Graph Connections */}
          <div className="bg-[var(--color-paper)] border border-sepia-200 rounded-2xl p-6 shadow-sm flex-1 flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-sepia-100 pb-3">
               <h3 className="font-serif font-bold text-xl text-sepia-900 flex items-center gap-2">
                 <Users size={20} className="text-sepia-600" /> Linked Persons
                 <span className="bg-sepia-100 text-sepia-800 text-xs font-bold px-2 py-0.5 rounded-full ml-1">{memory.taggedPeople.length}</span>
               </h3>
               <button type="button" onClick={() => setShowAddModal(true)} className="text-sm font-medium text-sepia-700 bg-sepia-100 hover:bg-sepia-200 border border-sepia-300 px-3 py-1 rounded-md transition-colors flex items-center gap-1">
                 <Users size={14} /> New Person
               </button>
            </div>
            
            {/* Active Tags with Roles */}
            {memory.taggedPeople.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-sepia-500 uppercase tracking-wider">Active Entities</h4>
                <div className="bg-sepia-50/50 border border-sepia-200 rounded-xl divide-y divide-sepia-100">
                  {memory.taggedPeople.map(tagged => {
                    const personData = availablePeople.find(p => p.id === tagged.id);
                    if (!personData) return null;
                    
                    return (
                      <div key={tagged.id} className="flex items-center justify-between p-3 gap-4">
                        <span className="font-medium text-sepia-900 truncate">{personData.display_name}</span>
                        <select 
                          value={tagged.role}
                          onChange={(e) => updatePersonRole(tagged.id, e.target.value)}
                          className="bg-white border border-sepia-200 rounded-lg text-sm text-sepia-700 py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-sepia-400"
                        >
                          <option value="subject">Subject (In Frame)</option>
                          <option value="photographer">Photographer / Creator</option>
                          <option value="author">Author (Document)</option>
                          <option value="nif">NIF (Present, Not In Frame)</option>
                          <option value="mentioned">Mentioned (Text/Audio)</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Available Person Picker */}
            <div>
              <h4 className="text-xs font-bold text-sepia-500 uppercase tracking-wider mb-3">Add Graph Edge</h4>
              <div className="flex flex-wrap gap-2">
                {availablePeople.map(person => {
                  const isSelected = memory.taggedPeople.some(p => p.id === person.id);
                  return (
                    <button 
                      key={person.id}
                      onClick={() => togglePersonTag(person.id)}
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-all duration-200 flex items-center gap-1.5
                        ${isSelected 
                          ? 'bg-sepia-800 text-sepia-50 border-sepia-900 shadow-sm opacity-50' 
                          : 'bg-sepia-50 text-sepia-700 border-sepia-300 hover:bg-sepia-100 hover:border-sepia-400'
                        }`}
                    >
                      {isSelected && <Check size={14} />}
                      {person.display_name}
                    </button>
                  )
                })}
                {availablePeople.length === 0 && (
                  <div className="w-full text-center py-6 border-2 border-dashed border-sepia-200 rounded-lg text-sepia-500 text-sm">
                    No persons in relational database.
                  </div>
                )}
              </div>
            </div>
            
          </div>

        </div>
      </div>
    </div>
  );
}
