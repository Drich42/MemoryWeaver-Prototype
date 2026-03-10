import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Users, Calendar, MapPin, Search, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Memories() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="font-medium">Connection Error: {error}</p>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-paper)] p-4 rounded-xl border border-sepia-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia-500" size={18} />
          <input 
            type="text" 
            placeholder="Search artifacts by title, person, or context..." 
            className="w-full pl-10 pr-4 py-2 bg-sepia-50 border border-sepia-300 rounded-lg text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 focus:border-transparent transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-sepia-100 text-sepia-800 border border-sepia-300 rounded-lg hover:bg-sepia-200 transition-colors font-medium">
            <Filter size={18} /> Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-sepia-100 text-sepia-800 border border-sepia-300 rounded-lg hover:bg-sepia-200 transition-colors font-medium">
            <Calendar size={18} /> Timeline
          </button>
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
        ) : memories.length === 0 ? (
           <div className="col-span-full p-12 text-center text-sepia-500 bg-[var(--color-paper)] rounded-xl border border-dashed border-sepia-300">
             <ImageIcon size={48} className="mx-auto mb-4 text-sepia-300" />
             <h3 className="text-xl font-medium text-sepia-900 mb-2">Archive is Empty</h3>
             <p>No memories have been uploaded or detected.</p>
           </div>
        ) : (
          memories.map(memory => (
            <div key={memory.id} onClick={() => navigate(`/memories/${memory.id}`)} className="group cursor-pointer flex flex-col bg-[var(--color-paper)] border border-sepia-200 rounded-xl overflow-hidden hover:border-sepia-400 hover:shadow-lg transition-all relative">
              <div className="aspect-[4/3] bg-sepia-100 relative flex items-center justify-center overflow-hidden border-b border-sepia-200">
                {memory.hasPhoto ? (
                  <img src={memory.hasPhoto} alt={memory.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <ImageIcon size={32} className="text-sepia-300" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-sepia-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-sepia-100 text-sm font-medium capitalize bg-sepia-900/50 backdrop-blur-sm px-2 py-1 rounded">{memory.type}</span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col bg-gradient-to-b from-[var(--color-paper)] to-sepia-50/50">
                <h3 className="text-lg font-bold text-sepia-900 mb-3 font-serif line-clamp-2 leading-tight group-hover:text-sepia-700 transition-colors">{memory.title}</h3>
                <div className="mt-auto space-y-2.5 text-sm font-medium text-sepia-600">
                  <div className="flex items-center gap-2.5">
                    <Calendar size={14} className="text-sepia-400 flex-shrink-0" />
                    <span className="truncate">{memory.date}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <MapPin size={14} className="text-sepia-400 flex-shrink-0" />
                    <span className="truncate">{memory.location}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Users size={14} className="text-sepia-400 flex-shrink-0" />
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
