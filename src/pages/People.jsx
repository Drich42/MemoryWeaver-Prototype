import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, AlertCircle, Users, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DateRangePicker from '../components/DateRangePicker';

export default function People() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  // Add Person Form State
  const [newPerson, setNewPerson] = useState({
    display_name: '',
    first_name: '',
    last_name: '',
    birth: { startDate: null, endDate: null, dateText: null },
    death: { startDate: null, endDate: null, dateText: null },
    isDeceased: false
  });
  const [addingError, setAddingError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      if (!supabase) throw new Error("Supabase client not initialized.");

      const { data, error: fetchError } = await supabase
        .from('persons')
        .select(`
          id,
          display_name,
          birth_start_date,
          death_start_date,
          memory_persons ( count )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedPeople = (data || []).map(p => {
        const startYear = p.birth_start_date ? p.birth_start_date.split('-')[0] : '?';
        const endYear = p.death_start_date ? p.death_start_date.split('-')[0] : 'Present';
        const dates = `${startYear} - ${endYear}`;
        
        const memCount = p.memory_persons?.[0]?.count || 0;

        return {
          id: p.id,
          name: p.display_name,
          dates,
          memoryCount: memCount,
          relation: 'Actor'
        };
      });

      setPeople(formattedPeople);
    } catch (err) {
      console.error("Error fetching people:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const handleAddPerson = async (e) => {
    e.preventDefault();
    setIsAdding(true);
    setAddingError(null);
    try {
      const { error: insertError } = await supabase
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
        }]);
      
      if (insertError) throw insertError;
      
      // Reset and reload
      setShowAddModal(false);
      setNewPerson({ display_name: '', first_name: '', last_name: '', birth: { startDate: null, endDate: null, dateText: null }, death: { startDate: null, endDate: null, dateText: null }, isDeceased: false });
      fetchPeople();
    } catch (err) {
      console.error("Error adding person:", err);
      setAddingError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 relative">
      
      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="font-medium">Connection Error: {error}</p>
        </div>
      )}

      {/* Add Person Modal */}
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

              <div className="space-y-1">
                <label className="text-sm font-semibold text-sepia-800">Known As (Alias)</label>
                <input value={newPerson.known_as} onChange={e => setNewPerson({...newPerson, known_as: e.target.value})} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" placeholder="e.g. Grandma Rose" />
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
                <button type="submit" disabled={isAdding || !newPerson.display_name} className="flex items-center gap-2 bg-sepia-800 text-sepia-50 px-5 py-2.5 rounded-lg font-medium hover:bg-sepia-900 transition-colors disabled:opacity-50">
                  {isAdding ? 'Adding...' : 'Create Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-sepia-900">People Directory</h1>
          <p className="text-sepia-600 mt-1">The actors spanning your historical archive.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia-500" size={18} />
            <input 
              type="text" 
              placeholder="Find person..." 
              className="w-full pl-10 pr-4 py-2 bg-[var(--color-paper)] border border-sepia-300 rounded-lg text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 focus:border-transparent transition-colors shadow-sm"
            />
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-sepia-800 text-sepia-50 px-4 py-2 rounded-lg font-medium hover:bg-sepia-900 transition-colors whitespace-nowrap shadow-sm border border-sepia-900">
            <UserPlus size={18} />
            Add Person
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          // Loading Skeletons
          [1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-sepia-50 p-6 rounded-xl border border-sepia-200 flex items-start gap-4 animate-pulse">
               <div className="w-16 h-16 rounded-full bg-sepia-200 flex-shrink-0"></div>
               <div className="flex-1 space-y-3 pt-2">
                 <div className="h-5 bg-sepia-200 rounded w-2/3"></div>
                 <div className="h-4 bg-sepia-200 rounded w-1/3"></div>
               </div>
            </div>
          ))
        ) : people.length === 0 ? (
          <div className="col-span-full p-12 text-center text-sepia-500 bg-sepia-50 rounded-xl border border-dashed border-sepia-300 flex flex-col items-center">
            <Users size={48} className="mb-4 text-sepia-300" />
            <h3 className="text-xl font-medium text-sepia-900 mb-2">No People Indexed</h3>
            <p>Add a person to begin connecting your archival graph.</p>
          </div>
        ) : (
          people.map(person => (
            <div key={person.id} onClick={() => navigate(`/people/${person.id}`)} className="group bg-[var(--color-paper)] p-6 rounded-xl border border-sepia-200 flex items-start gap-4 hover:border-sepia-400 hover:shadow-md transition-all cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-sepia-100 border border-sepia-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                <svg className="w-10 h-10 text-sepia-400 mt-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-bold text-lg text-sepia-950 font-serif group-hover:text-sepia-800 transition-colors truncate">{person.name}</h3>
                <p className="text-xs font-semibold text-sepia-500 tracking-wider uppercase mb-2">{person.relation}</p>
                <div className="flex items-center justify-between text-sm text-sepia-700">
                  <span>{person.dates}</span>
                  <span className="font-semibold bg-sepia-100 border border-sepia-200 px-2 py-0.5 rounded-md text-sepia-800">{person.memoryCount} links</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
