import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, X, Plus } from 'lucide-react';

export default function PlacePicker({ selectedPlaceIds, onChange }) {
  const [places, setPlaces] = useState([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState(null);
  
  const [newPlace, setNewPlace] = useState({
    placename: '',
    city_town: '',
    county: '',
    state_region: '',
    country: ''
  });

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      const { data, error } = await supabase
        .from('places')
        .select('id, placename, city_town, state_region, country')
        .order('placename', { ascending: true });
        
      if (error) throw error;
      setPlaces(data || []);
    } catch (err) {
      console.error("Error fetching places:", err);
    }
  };

  const handleCreatePlace = async (e) => {
    e.preventDefault();
    setIsAdding(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('places')
        .insert([{
          placename: newPlace.placename || newPlace.city_town || 'Unknown Place',
          city_town: newPlace.city_town || null,
          county: newPlace.county || null,
          state_region: newPlace.state_region || null,
          country: newPlace.country || null
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Select the newly created place
      onChange([...selectedPlaceIds, data.id]);
      
      // Reset
      setShowAddModal(false);
      setNewPlace({ placename: '', city_town: '', county: '', state_region: '', country: '' });
      await fetchPlaces();
    } catch (err) {
      console.error("Error adding place:", err);
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const formatPlaceLabel = (p) => {
    const parts = [p.placename, p.city_town, p.state_region, p.country].filter(Boolean);
    // deduplicate (e.g. if placename is same as city)
    const uniqueParts = [...new Set(parts)];
    return uniqueParts.join(', ') || 'Unnamed Location';
  };

  const togglePlace = (id) => {
    if (selectedPlaceIds.includes(id)) {
      onChange(selectedPlaceIds.filter(pid => pid !== id));
    } else {
      onChange([...selectedPlaceIds, id]);
    }
  };

  const filteredPlaces = places.filter(p => 
    formatPlaceLabel(p).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-sepia-200 pb-2">
        <label className="text-sm font-semibold text-sepia-800 flex items-center gap-2">
          <MapPin size={16}/> Location Tags
        </label>
        <button 
          type="button" 
          onClick={() => setShowAddModal(true)} 
          className="text-sm font-medium text-sepia-700 bg-sepia-100 hover:bg-sepia-200 border border-sepia-300 px-3 py-1 rounded-md transition-colors flex items-center gap-1"
        >
          <Plus size={14} /> New Location
        </button>
      </div>

      <div className="relative">
        <input 
          type="text" 
          placeholder="Search locations..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 text-sm" 
        />
        
        {search && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-sepia-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredPlaces.length > 0 ? (
              filteredPlaces.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    togglePlace(p.id);
                    setSearch('');
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-sepia-900 hover:bg-sepia-50 flex items-center justify-between"
                >
                  <span className="truncate">{formatPlaceLabel(p)}</span>
                  {selectedPlaceIds.includes(p.id) && <span className="text-sepia-500 text-xs">Selected</span>}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-sepia-500">
                No locations found matching "{search}"
                <button 
                  type="button"
                  onClick={() => {
                    setNewPlace(prev => ({...prev, placename: search}));
                    setShowAddModal(true);
                  }}
                  className="block w-full mt-2 text-sepia-700 underline font-medium"
                >
                  Create "{search}"
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPlaceIds.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedPlaceIds.map(id => {
            const place = places.find(p => p.id === id);
            if (!place) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 px-3 py-1 bg-sepia-800 text-sepia-50 text-xs font-medium rounded-full">
                {formatPlaceLabel(place)}
                <button type="button" onClick={() => togglePlace(id)} className="hover:text-red-300 ml-1">
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-sepia-950/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper)] rounded-2xl border border-sepia-200 shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-sepia-100 bg-sepia-50/50">
              <h3 className="font-serif font-bold text-lg text-sepia-900 flex items-center gap-2"><MapPin size={18}/> New Location</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-sepia-400 hover:text-sepia-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreatePlace} className="p-5 space-y-4 text-left">
              {error && <p className="text-red-600 text-sm">{error}</p>}
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-sepia-600 uppercase tracking-wider">Specific Place / Landmark</label>
                <input value={newPlace.placename} onChange={e => setNewPlace({...newPlace, placename: e.target.value})} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 text-sm" placeholder="e.g. Camp Foster, Uncle Bob's Farm" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-sepia-600 uppercase tracking-wider">City / Town</label>
                  <input value={newPlace.city_town} onChange={e => setNewPlace({...newPlace, city_town: e.target.value})} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 text-sm" placeholder="e.g. Austin" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-sepia-600 uppercase tracking-wider">County</label>
                  <input value={newPlace.county} onChange={e => setNewPlace({...newPlace, county: e.target.value})} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 text-sm" placeholder="e.g. Travis" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-sepia-600 uppercase tracking-wider">State / Region</label>
                  <input value={newPlace.state_region} onChange={e => setNewPlace({...newPlace, state_region: e.target.value})} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 text-sm" placeholder="e.g. Texas" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-sepia-600 uppercase tracking-wider">Country</label>
                  <input value={newPlace.country} onChange={e => setNewPlace({...newPlace, country: e.target.value})} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 text-sm" placeholder="e.g. USA" />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-sepia-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-sepia-700 font-medium hover:bg-sepia-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isAdding || (!newPlace.placename && !newPlace.city_town && !newPlace.state_region && !newPlace.country)} className="flex items-center gap-2 bg-sepia-800 text-sepia-50 px-5 py-2 rounded-lg text-sm font-medium hover:bg-sepia-900 transition-colors disabled:opacity-50">
                  {isAdding ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
