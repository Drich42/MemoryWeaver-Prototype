import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, X, Check, Search, Calendar, MapPin, Tag, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DateRangePicker from '../components/DateRangePicker';
import PlacePicker from '../components/PlacePicker';

export default function UploadWorkflow() {
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Batch Data 
  // Each file will be an object: { file, previewUrl, title, type }
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  // Shared Metadata for the batch
  const [date, setDate] = useState({ startDate: null, endDate: null, dateText: null });
  const [description, setDescription] = useState('');
  
  // Graph Data (applies to all files in batch)
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [availablePeople, setAvailablePeople] = useState([]);
  const [selectedPlaces, setSelectedPlaces] = useState([]);

  // Process a single file into our batch format
  const processFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      // Auto-generate title
      let fileName = file.name;
      const lastDot = fileName.lastIndexOf('.');
      if (lastDot !== -1) fileName = fileName.substring(0, lastDot);

      reader.onloadend = () => {
        resolve({
          file,
          previewUrl: reader.result,
          title: fileName,
          type: 'photo' // Default type
        });
      };
      
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        resolve({
          file,
          previewUrl: 'file_selected',
          title: fileName,
          type: 'document'
        });
      }
    });
  };

  const handleFilesSelect = async (files) => {
    if (!files || files.length === 0) return;
    
    // Process all dropped/selected files
    const newFiles = await Promise.all(Array.from(files).map(processFile));
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };
  
  const handleUpdateFileBatch = (index, field, value) => {
    const updated = [...selectedFiles];
    updated[index][field] = value;
    setSelectedFiles(updated);
  };

  const handleRemoveFile = (index) => {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
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

  const fetchPeople = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('persons').select('id, display_name').order('created_at', { ascending: false });
    if (data) setAvailablePeople(data);
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const handleCreateMemory = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;
    
    setIsUploading(true);
    
    try {
      // Create all memory nodes first
      // Create all memory nodes sequentially, waiting for storage uploads
      const memoryInserts = [];
      
      for (const fileItem of selectedFiles) {
        let artifact_url = fileItem.previewUrl;
        
        // Upload to Storage if actual file exists
        if (fileItem.file && fileItem.file.name) {
          const fileExt = fileItem.file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('artifacts')
            .upload(fileName, fileItem.file);
            
          if (uploadError) throw uploadError;
          
          const { data: urlData } = supabase.storage.from('artifacts').getPublicUrl(fileName);
          artifact_url = urlData.publicUrl;
        }

        memoryInserts.push({
          title: fileItem.title,
          type: fileItem.type,
          start_date: date.startDate || null,
          end_date: date.endDate || null,
          date_text: date.dateText || null,
          description: description,
          status: 'published',
          artifact_url: artifact_url
        });
      }
      
      const { data: memoryData, error: memError } = await supabase
        .from('memories')
        .insert(memoryInserts)
        .select('id');
        
      if (memError) throw memError;
      
      // If people are tagged, create edges for all new memories
      if (selectedPeople.length > 0 && memoryData && memoryData.length > 0) {
        const edges = [];
        
        memoryData.forEach(memory => {
          selectedPeople.forEach(personId => {
            edges.push({
              memory_id: memory.id,
              person_id: personId,
              role: 'subject'
            });
          });
        });
        
        const { error: edgeError } = await supabase.from('memory_persons').insert(edges);
        if (edgeError) throw edgeError;
      }

      // If places are tagged, create edges for all new memories
      if (selectedPlaces.length > 0 && memoryData && memoryData.length > 0) {
        const placeEdges = [];
        
        memoryData.forEach(memory => {
          selectedPlaces.forEach(placeId => {
            placeEdges.push({
              memory_id: memory.id,
              place_id: placeId
            });
          });
        });
        
        const { error: placeEdgeError } = await supabase.from('memory_places').insert(placeEdges);
        if (placeEdgeError) throw placeEdgeError;
      }
      
      setStep(3); // Success Step
    } catch (err) {
      console.error("Batch upload failed:", err);
      alert("Failed to create memories. See console.");
    } finally {
      setIsUploading(false);
    }
  };

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
      
      // Auto-tag the newly created person
      setSelectedPeople(prev => [...prev, data.id]);
      
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

  const togglePerson = (id) => {
    setSelectedPeople(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-3xl mx-auto py-8 animate-in fade-in duration-500 relative">
      
      {/* Add Person Modal (Ported from People.jsx) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-sepia-950/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper)] rounded-2xl border border-sepia-200 shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-sepia-100 bg-sepia-50/50">
              <h3 className="font-serif font-bold text-xl text-sepia-900">Add Person to Graph</h3>
              <button onClick={() => setShowAddModal(false)} className="text-sepia-400 hover:text-sepia-700 transition-colors">
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

      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-sepia-900">Ingest Artifact</h1>
        <p className="text-sepia-600 mt-2">Upload a file, define its metadata, and connect it to the graph.</p>
      </div>

      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-sepia-200 -z-10 rounded-full"></div>
        {[1, 2, 3].map((s) => (
          <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors duration-300 ${step >= s ? 'bg-sepia-800 text-sepia-50' : 'bg-sepia-100 text-sepia-400 border-2 border-sepia-200'}`}>
            {step > s ? <Check size={20} /> : s}
          </div>
        ))}
      </div>

      <div className="bg-[var(--color-paper)] border border-sepia-200 rounded-2xl p-8 shadow-sm relative z-0">
        
        {step === 1 && (
          <form onSubmit={() => setStep(2)} className="space-y-6">
            
            {/* Multi-file Dropzone */}
            <div 
              onClick={() => document.getElementById('artifact-upload').click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFilesSelect(e.dataTransfer.files);
                }
              }}
              className={`border-2 border-dashed ${isDragging ? 'border-sepia-600 bg-sepia-100' : 'border-sepia-300 hover:bg-sepia-50'} rounded-xl p-10 text-center transition-all cursor-pointer group relative overflow-hidden`}
            >
              <UploadIcon size={48} className={`mx-auto mb-4 ${isDragging ? 'text-sepia-600 scale-110' : 'text-sepia-400'} group-hover:text-sepia-600 group-hover:scale-110 transition-all`} />
              <h3 className="text-lg font-medium text-sepia-900 mb-1">
                {isDragging ? 'Drop Files Here' : 'Select Artifacts'}
              </h3>
              <p className="text-sepia-500 text-sm">Drag & drop photos, videos, or documents here, or click to browse</p>
              
              <input 
                type="file" 
                id="artifact-upload" 
                className="hidden" 
                multiple
                accept="image/*,video/*,application/pdf"
                onChange={(e) => {
                  if(e.target.files && e.target.files.length > 0) {
                     handleFilesSelect(e.target.files);
                  }
                }}
              />
            </div>

            {/* Batch Grid */}
            {selectedFiles.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-sepia-200">
                <h3 className="font-serif font-bold text-sepia-900 flex items-center gap-2">
                  <Tag size={18} className="text-sepia-500" /> 
                  Batch Items ({selectedFiles.length})
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedFiles.map((item, index) => (
                    <div key={index} className="bg-sepia-50 border border-sepia-200 rounded-lg p-3 flex gap-4 relative group animate-in slide-in-from-bottom-2">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveFile(index)}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                      >
                        <X size={14} />
                      </button>
                      
                      <div className="w-20 h-20 bg-[var(--color-paper)] rounded border border-sepia-300 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {item.previewUrl && item.previewUrl !== 'file_selected' ? (
                          <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <UploadIcon className="text-sepia-300" size={24} />
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-2 min-w-0">
                        <input 
                          type="text" 
                          required
                          value={item.title} 
                          onChange={(e) => handleUpdateFileBatch(index, 'title', e.target.value)}
                          className="w-full text-sm font-medium bg-transparent border-b border-sepia-300 focus:border-sepia-600 focus:outline-none truncate py-1 text-sepia-900"
                          placeholder="Artifact Title"
                        />
                        <select 
                          value={item.type} 
                          onChange={(e) => handleUpdateFileBatch(index, 'type', e.target.value)}
                          className="w-full text-xs bg-[var(--color-paper)] border border-sepia-300 rounded p-1 text-sepia-700 focus:outline-none"
                        >
                          <option value="photo">Photograph</option>
                          <option value="document">Document / Letter</option>
                          <option value="video">Video</option>
                          <option value="audio">Audio / Oral History</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-end pt-4">
              <button type="submit" disabled={selectedFiles.length === 0} className="bg-sepia-800 text-sepia-50 px-8 py-3 rounded-lg font-medium hover:bg-sepia-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Next: Build Connections
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleCreateMemory} className="space-y-8 animate-in slide-in-from-right-4">
            
            <div className="space-y-4">
               <div className="flex items-center justify-between border-b border-sepia-200 pb-2">
                 <h3 className="text-lg font-serif font-bold text-sepia-900">Tag People (Graph Edges)</h3>
                 <button type="button" onClick={() => setShowAddModal(true)} className="text-sm font-medium text-sepia-700 bg-sepia-100 hover:bg-sepia-200 border border-sepia-300 px-3 py-1 rounded-md transition-colors flex items-center gap-1">
                   <Users size={14} /> New Person
                 </button>
               </div>
               
               <div className="flex flex-wrap gap-3">
                 {availablePeople.map(person => (
                   <button 
                     key={person.id}
                     type="button"
                     onClick={() => togglePerson(person.id)}
                     className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${selectedPeople.includes(person.id) ? 'bg-sepia-800 text-sepia-50 border-sepia-900 shadow-sm' : 'bg-sepia-50 text-sepia-700 border-sepia-300 hover:bg-sepia-100'}`}
                   >
                     {person.display_name}
                   </button>
                 ))}
                 {availablePeople.length === 0 && <span className="text-sepia-500 text-sm italic">No people found in database.</span>}
               </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-sepia-200">
               <DateRangePicker 
                 label="Memory Date (Temporal Node)" 
                 value={date} 
                 onChange={setDate} 
               />
               <div className="mt-6">
                 <PlacePicker 
                   selectedPlaceIds={selectedPlaces}
                   onChange={setSelectedPlaces}
                 />
               </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-sepia-800 text-left">Description / Story / OCR text</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-3 text-sepia-900 h-32 focus:outline-none focus:ring-2 focus:ring-sepia-400" placeholder="Add story context, or parsed OCR text here..." />
            </div>

            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setStep(1)} className="px-6 py-3 text-sepia-700 font-medium hover:bg-sepia-100 rounded-lg transition-colors">Back</button>
              <button type="submit" disabled={isUploading} className="flex items-center gap-2 bg-sepia-800 text-sepia-50 px-8 py-3 rounded-lg font-medium hover:bg-sepia-900 transition-colors disabled:opacity-50">
                {isUploading ? 'Ingesting Artifact...' : 'Publish to Archive'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="text-center py-12 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="stroke-[3]" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-sepia-900 mb-2">Artifact Ingested</h2>
            <p className="text-sepia-600 mb-8 max-w-md mx-auto">The memory node was successfully created and linked to {selectedPeople.length} people in the graph.</p>
            
            <div className="flex justify-center gap-4">
              <button onClick={() => window.location.href = '/memories'} className="px-6 py-2.5 bg-sepia-100 text-sepia-900 rounded-lg font-medium hover:bg-sepia-200 transition-colors">
                View Archive
              </button>
              <button onClick={() => { setStep(1); setSelectedFiles([]); setSelectedPeople([]); setDate({ startDate: null, endDate: null, dateText: null }); setDescription(''); }} className="px-6 py-2.5 bg-sepia-800 text-sepia-50 rounded-lg font-medium hover:bg-sepia-900 transition-colors">
                Upload Another
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
