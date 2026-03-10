import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Trash2, Users, Network, X, UserPlus } from 'lucide-react';
import DateRangePicker from '../components/DateRangePicker';

export default function PersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  console.log("RENDERED PersonDetail, id:", id);

  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [availablePeople, setAvailablePeople] = useState([]);

  // Relationship states
  const [parents, setParents] = useState([]);
  const [spouses, setSpouses] = useState([]);
  const [children, setChildren] = useState([]);
  const [siblings, setSiblings] = useState([]);

  // Track original states for dirty checking
  const [initialPerson, setInitialPerson] = useState(null);
  const [initialParents, setInitialParents] = useState([]);
  const [initialSpouses, setInitialSpouses] = useState([]);
  const [initialChildren, setInitialChildren] = useState([]);

  // UI states for adding relationships
  const [selectedRelPerson, setSelectedRelPerson] = useState('');
  const [selectedRelType, setSelectedRelType] = useState('parent');

  useEffect(() => {
    console.log("useEffect triggered for id:", id);
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Person Metadata
        const { data: personData, error: personError } = await supabase
          .from('persons')
          .select('*')
          .eq('id', id)
          .single();

        if (personError) throw personError;
        const formattedPerson = {
          ...personData,
          birth: {
            startDate: personData.birth_start_date || null,
            endDate: personData.birth_end_date || null,
            dateText: personData.birth_text || null
          },
          death: {
            startDate: personData.death_start_date || null,
            endDate: personData.death_end_date || null,
            dateText: personData.death_text || null
          },
          isDeceased: Boolean(personData.death_start_date || personData.death_end_date || personData.death_text)
        };
        setPerson(formattedPerson);

        // 2. Fetch all available people (for the dropdown)
        const { data: allPeople, error: allError } = await supabase
          .from('persons')
          .select('id, display_name')
          .neq('id', id)
          .order('display_name');

        if (allError) throw allError;
        setAvailablePeople(allPeople || []);

        // 3. Fetch specific relationships for this person
        const { data: relsData, error: relsError } = await supabase
          .from('person_relationships')
          .select('*')
          .eq('person_a_id', id);

        if (relsError) throw relsError;

        const fetchedParents = relsData
          .filter(r => r.relationship_type === 'parent' || r.relationship_type === 'stepparent')
          .map(r => ({ id: r.person_b_id, isStep: r.relationship_type === 'stepparent' }));

        const fetchedSpouses = relsData
          .filter(r => r.relationship_type === 'spouse')
          .map(r => ({
            id: r.person_b_id,
            start_date: r.start_date || '',
            end_date: r.end_date || ''
          }));

        const fetchedChildren = relsData
          .filter(r => r.relationship_type === 'child' || r.relationship_type === 'stepchild')
          .map(r => ({ id: r.person_b_id, isStep: r.relationship_type === 'stepchild' }));

        setParents(fetchedParents);
        setSpouses(fetchedSpouses);
        setChildren(fetchedChildren);

        // Store initial states for dirty checking
        setInitialPerson(formattedPerson);
        setInitialParents(fetchedParents);
        setInitialSpouses(fetchedSpouses);
        setInitialChildren(fetchedChildren);

        // 4. Derive siblings
        const bioParents = fetchedParents.filter(p => !p.isStep).map(p => p.id);
        if (bioParents.length > 0) {
          const { data: siblingEdges } = await supabase
            .from('person_relationships')
            .select('person_b_id')
            .in('person_a_id', bioParents)
            .eq('relationship_type', 'child')
            .neq('person_b_id', id);

          if (siblingEdges) {
            const counts = {};
            siblingEdges.forEach(edge => {
              counts[edge.person_b_id] = (counts[edge.person_b_id] || 0) + 1;
            });
            const derivedSiblings = Object.keys(counts).map(sibId => ({
              id: sibId,
              sharedCount: counts[sibId]
            }));
            setSiblings(derivedSiblings);
          }
        }

      } catch (err) {
        console.error("Error fetching person detail:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const fetchPeople = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('persons').select('id, display_name').neq('id', id).order('display_name');
    if (data) setAvailablePeople(data);
  };

  // Add Person Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPerson, setNewPerson] = useState({
    display_name: '', first_name: '', last_name: '', email: '',
    birth: { startDate: null, endDate: null, dateText: null },
    death: { startDate: null, endDate: null, dateText: null }
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
          email: newPerson.email || null,
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

      // Select the newly created person automatically for immediate linking
      setSelectedRelPerson(data.id);

      // Reset and reload
      setShowAddModal(false);
      setNewPerson({ display_name: '', first_name: '', last_name: '', email: '', birth: { startDate: null, endDate: null, dateText: null }, death: { startDate: null, endDate: null, dateText: null } });
      await fetchPeople();
    } catch (err) {
      console.error("Error adding person:", err);
      setAddingError(err.message);
    } finally {
      setIsAddingPerson(false);
    }
  };

  const isProfileDirty = () => {
    if (!initialPerson || !person) return false;

    // Check core metadata
    if (JSON.stringify(initialPerson) !== JSON.stringify(person)) return true;

    // Check relationships
    if (JSON.stringify(initialParents) !== JSON.stringify(parents)) return true;
    if (JSON.stringify(initialChildren) !== JSON.stringify(children)) return true;
    if (JSON.stringify(initialSpouses) !== JSON.stringify(spouses)) return true;

    return false;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Update Core Metadata
      const { error: updateError } = await supabase
        .from('persons')
        .update({
          display_name: person.display_name,
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email,
          birth_start_date: person.birth?.startDate || null,
          birth_end_date: person.birth?.endDate || null,
          birth_text: person.birth?.dateText || null,
          death_start_date: person.isDeceased ? (person.death?.startDate || null) : null,
          death_end_date: person.isDeceased ? (person.death?.endDate || null) : null,
          death_text: person.isDeceased ? (person.death?.dateText || null) : null,
          biography: person.biography
        })
        .eq('id', person.id);

      if (updateError) throw updateError;

      // 2. Update Graph Connections
      // First, clear all relationships involving this person to avoid unique constraint conflicts
      const { error: deleteEdgesError } = await supabase
        .from('person_relationships')
        .delete()
        .or(`person_a_id.eq.${person.id},person_b_id.eq.${person.id}`);

      if (deleteEdgesError) throw deleteEdgesError;

      // Build bi-directional edges array
      const edgesToInsert = [];
      const pushEdge = (a, b, typeA, typeB, start = null, end = null) => {
        edgesToInsert.push({ person_a_id: a, person_b_id: b, relationship_type: typeA, start_date: start, end_date: end });
        edgesToInsert.push({ person_a_id: b, person_b_id: a, relationship_type: typeB, start_date: start, end_date: end });
      };

      parents.forEach(p => pushEdge(person.id, p.id, p.isStep ? 'stepparent' : 'parent', p.isStep ? 'stepchild' : 'child'));
      children.forEach(c => pushEdge(person.id, c.id, c.isStep ? 'stepchild' : 'child', c.isStep ? 'stepparent' : 'parent'));
      spouses.forEach(s => pushEdge(person.id, s.id, 'spouse', 'spouse', s.start_date || null, s.end_date || null));

      // Deduplicate edges (edge case if someone was accidentally added as parent and child somehow)
      const uniqueEdges = Array.from(new Set(edgesToInsert.map(e => JSON.stringify(e)))).map(e => JSON.parse(e));

      if (uniqueEdges.length > 0) {
        const { error: insertEdgesError } = await supabase
          .from('person_relationships')
          .insert(uniqueEdges);

        if (insertEdgesError) throw insertEdgesError;
      }

      navigate('/people');
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save changes. " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this person and all their graph links?")) return;
    try {
      const { error: deleteError } = await supabase
        .from('persons')
        .delete()
        .eq('id', person.id);

      if (deleteError) throw deleteError;
      navigate('/people');
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete person.");
    }
  };

  const handleAddRelationship = () => {
    if (!selectedRelPerson) return;

    // Remove person from any existing arrays to prevent overlap
    setParents(prev => prev.filter(p => p.id !== selectedRelPerson));
    setChildren(prev => prev.filter(c => c.id !== selectedRelPerson));
    setSpouses(prev => prev.filter(s => s.id !== selectedRelPerson));

    // Add to specific array
    if (selectedRelType === 'parent') setParents(prev => [...prev, { id: selectedRelPerson, isStep: false }]);
    if (selectedRelType === 'stepparent') setParents(prev => [...prev, { id: selectedRelPerson, isStep: true }]);
    if (selectedRelType === 'child') setChildren(prev => [...prev, { id: selectedRelPerson, isStep: false }]);
    if (selectedRelType === 'stepchild') setChildren(prev => [...prev, { id: selectedRelPerson, isStep: true }]);
    if (selectedRelType === 'spouse') setSpouses(prev => [...prev, { id: selectedRelPerson, start_date: '', end_date: '' }]);

    setSelectedRelPerson('');
  };

  const removeRelationship = (idToRemove) => {
    setParents(prev => prev.filter(p => p.id !== idToRemove));
    setChildren(prev => prev.filter(c => c.id !== idToRemove));
    setSpouses(prev => prev.filter(s => s.id !== idToRemove));
  };

  const updateSpouseDate = (spouseId, field, value) => {
    setSpouses(prev => prev.map(s => s.id === spouseId ? { ...s, [field]: value } : s));
  };

  // ----- Dirty State Tracker -----
  const isDirty = React.useMemo(() => {
    if (!person || !initialPerson) return false;

    return (
      JSON.stringify(person) !== JSON.stringify(initialPerson) ||
      JSON.stringify(parents) !== JSON.stringify(initialParents) ||
      JSON.stringify(spouses) !== JSON.stringify(initialSpouses) ||
      JSON.stringify(children) !== JSON.stringify(initialChildren)
    );
  }, [person, initialPerson, parents, initialParents, spouses, initialSpouses, children, initialChildren]);

  // Intercept Browser Back Button / Reloads if Dirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleGoBack = () => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes! Are you sure you want to leave without saving?")) {
        return;
      }
    }
    navigate('/people');
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sepia-800"></div></div>;
  if (error || !person) return <div className="p-8 text-center text-red-800 bg-red-50 rounded-lg">{error || 'Not found'}</div>;

  const renderCurrentLinks = (itemsArray, title, linkType = 'default') => {
    if (itemsArray.length === 0) return null;

    const isReadOnly = linkType === 'sibling';
    const isSpouse = linkType === 'spouse';

    return (
      <div className="mb-4">
        <h4 className="text-sm font-bold text-sepia-500 uppercase tracking-wider mb-2">{title}</h4>
        <div className="flex flex-col gap-2">
          {itemsArray.map(item => {
            const id = item.id;
            const connectedPerson = availablePeople.find(p => p.id === id);

            // Format name with indicators
            const baseName = connectedPerson?.display_name || 'Unknown';
            let indicator = null;
            if (linkType === 'sibling' && item.sharedCount === 1) indicator = '(1/2)';
            if ((linkType === 'parent' || linkType === 'child') && item.isStep) indicator = '(s)';

            return (
              <div key={id} className="bg-white border border-sepia-200 p-3 rounded-md shadow-sm">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <button
                    onClick={() => {
                      if (isDirty && !window.confirm("Navigate away? Unsaved changes to this profile will be lost.")) {
                        return;
                      }
                      navigate(`/people/${id}`);
                    }}
                    className="font-medium text-sepia-900 hover:text-sepia-600 hover:underline text-left flex items-center gap-1.5"
                  >
                    <span>{baseName}</span>
                    {indicator && <span className="text-transparent selection:bg-blue-200 selection:text-blue-900 no-underline font-normal uppercase tracking-wide text-[10px]" aria-hidden="true">{indicator}</span>}
                  </button>
                  {!isReadOnly && (
                    <button onClick={() => removeRelationship(id)} className="text-sepia-400 hover:text-red-600 transition-colors">&times;</button>
                  )}
                </div>
                {isSpouse && !isReadOnly && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-sepia-500 block mb-0.5">Married</label>
                      <input type="date" value={item.start_date} onChange={e => updateSpouseDate(id, 'start_date', e.target.value)} className="w-full text-xs p-1.5 bg-sepia-50 border border-sepia-200 rounded focus:outline-none focus:ring-1 focus:ring-sepia-400" />
                    </div>
                    <div className="flex-none text-sepia-300 pt-3">-</div>
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-sepia-500 block mb-0.5">Ended</label>
                      <input type="date" value={item.end_date} onChange={e => updateSpouseDate(id, 'end_date', e.target.value)} className="w-full text-xs p-1.5 bg-sepia-50 border border-sepia-200 rounded focus:outline-none focus:ring-1 focus:ring-sepia-400" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-500 relative">

      {/* Add Person Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-sepia-950/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-paper)] rounded-2xl border border-sepia-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-sepia-100 bg-sepia-50/50 sticky top-0 z-10">
              <h3 className="font-serif font-bold text-lg md:text-xl text-sepia-900">Add Person to Graph</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-sepia-400 hover:text-sepia-700 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPerson} className="p-6 space-y-4 text-left">
              {addingError && <p className="text-red-600 text-sm">{addingError}</p>}

              <div className="space-y-1">
                <label className="text-sm font-semibold text-sepia-800">Display Name *</label>
                <input required value={newPerson.display_name} onChange={e => setNewPerson({ ...newPerson, display_name: e.target.value })} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" placeholder="e.g. Grandma Rose" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-sepia-800">First Name</label>
                  <input value={newPerson.first_name} onChange={e => setNewPerson({ ...newPerson, first_name: e.target.value })} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-sepia-800">Last Name</label>
                  <input value={newPerson.last_name} onChange={e => setNewPerson({ ...newPerson, last_name: e.target.value })} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-sepia-800">Email Contact</label>
                <input value={newPerson.email || ''} onChange={e => setNewPerson({ ...newPerson, email: e.target.value })} type="email" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" placeholder="person@example.com" />
              </div>

              <DateRangePicker
                label="Birth Date"
                value={newPerson.birth}
                onChange={(val) => setNewPerson({ ...newPerson, birth: val })}
              />
              <DateRangePicker
                label="Death Date"
                value={newPerson.death}
                onChange={(val) => setNewPerson({ ...newPerson, death: val })}
              />

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

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <button onClick={handleGoBack} className="w-full sm:w-auto flex items-center justify-center gap-2 text-sepia-600 hover:text-sepia-900 transition-colors font-medium bg-sepia-100/50 hover:bg-sepia-200 px-4 py-2 rounded-lg border border-sepia-200">
          <ArrowLeft size={18} /> <span className="hidden sm:inline">Back to Directory</span><span className="sm:hidden">Back</span>
        </button>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={handleDelete} className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg font-medium transition-colors border border-red-200">
            <Trash2 size={18} /> <span className="hidden sm:inline">Delete Person</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className={`flex-[2] sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-300 whitespace-nowrap
              ${isSaving ? 'opacity-50 cursor-not-allowed bg-sepia-200 text-sepia-500'
                : isDirty
                  ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md ring-2 ring-orange-500 ring-offset-2 ring-offset-[var(--color-bg)] animate-pulse'
                  : 'bg-sepia-800 text-sepia-50 hover:bg-sepia-900'
              }`}
          >
            <Save size={18} /> {isSaving ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-y-auto lg:overflow-hidden pb-12 lg:pb-0">

        {/* Left Column: Metadata */}
        <div className="flex-1 overflow-y-auto bg-[var(--color-paper)] border border-sepia-200 rounded-2xl p-6 shadow-sm space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-sepia-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <h3 className="font-serif font-bold text-2xl text-sepia-900 border-b border-sepia-100 pb-3 flex items-center gap-2">
            <Users size={24} className="text-sepia-600" /> Biographical Data
          </h3>

          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-sepia-800">Display Name / Index Tag</label>
              <input value={person.display_name} onChange={e => setPerson({ ...person, display_name: e.target.value })} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400 font-medium" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-sepia-800">Given / First Name</label>
              <input value={person.first_name || ''} onChange={e => setPerson({ ...person, first_name: e.target.value })} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" placeholder="Common name used by all" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-sepia-800">Surname / Last Name</label>
              <input value={person.last_name || ''} onChange={e => setPerson({ ...person, last_name: e.target.value })} type="text" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-sepia-800">Email Contact</label>
              <input value={person.email || ''} onChange={e => setPerson({ ...person, email: e.target.value })} type="email" className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-2.5 text-sepia-900 focus:outline-none focus:ring-2 focus:ring-sepia-400" placeholder="Required for sharing..." />
            </div>

            <div className="col-span-2">
              <DateRangePicker
                label="Birth Date"
                value={person.birth}
                onChange={(val) => setPerson({ ...person, birth: val })}
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer mb-2 w-max">
                <input
                  type="checkbox"
                  checked={person.isDeceased || false}
                  onChange={(e) => setPerson({ ...person, isDeceased: e.target.checked })}
                  className="w-4 h-4 text-sepia-600 border-sepia-300 rounded focus:ring-sepia-500"
                />
                <span className="text-sm font-semibold text-sepia-800">Person is Deceased</span>
              </label>

              {person.isDeceased && (
                <DateRangePicker
                  label="Death Date"
                  value={person.death || { startDate: null, endDate: null, dateText: null }}
                  onChange={(val) => setPerson({ ...person, death: val })}
                />
              )}
            </div>

            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-semibold text-sepia-800">Biography / Notes</label>
              <textarea value={person.biography || ''} onChange={e => setPerson({ ...person, biography: e.target.value })} className="w-full bg-sepia-50 border border-sepia-300 rounded-lg p-3 text-sepia-900 h-32 focus:outline-none focus:ring-2 focus:ring-sepia-400 resize-none" placeholder="Provide context about this person's life, profession, and history..." />
            </div>
          </div>
        </div>

        {/* Right Column: Graph Edges */}
        <div className="w-full lg:w-[450px] bg-[var(--color-paper)] border border-sepia-200 rounded-2xl p-6 shadow-sm flex flex-col space-y-6 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-sepia-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <div className="border-b border-sepia-100 pb-3">
            <h3 className="font-serif font-bold text-xl text-sepia-900 flex items-center gap-2">
              <Network size={20} className="text-sepia-600" /> Family Tree
            </h3>
            <p className="text-sm text-sepia-600 mt-1">Connect this node to other actors to form the relational family graph.</p>
          </div>

          {/* Active Graph UI */}
          <div className="flex-1 bg-sepia-50/50 border border-sepia-200 rounded-xl p-4">
            {parents.length === 0 && spouses.length === 0 && children.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-sepia-400 space-y-4">
                <Network size={40} className="opacity-50" />
                <span className="text-sm font-medium">No family links established.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {renderCurrentLinks(parents, 'Parents', 'parent')}
                {renderCurrentLinks(spouses, 'Spouses', 'spouse')}
                {renderCurrentLinks(children, 'Children', 'child')}
                {renderCurrentLinks(siblings, 'Siblings (Derived)', 'sibling')}
              </div>
            )}
          </div>

          {/* Graph Connection Tool */}
          <div className="pt-2 border-t border-sepia-200">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-sepia-500 uppercase tracking-wider">Add Graph Edge</h4>
              <button type="button" onClick={() => setShowAddModal(true)} className="text-[11px] font-medium text-sepia-700 bg-sepia-100 hover:bg-sepia-200 border border-sepia-300 px-2 py-0.5 rounded transition-colors flex items-center gap-1">
                <UserPlus size={12} /> New Person
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <select
                className="bg-sepia-50 border border-sepia-300 rounded flex-1 p-2 text-sm text-sepia-900 focus:outline-none"
                value={selectedRelPerson}
                onChange={e => setSelectedRelPerson(e.target.value)}
              >
                <option value="" disabled>Select a person...</option>
                {availablePeople.filter(p => !parents.some(x => x.id === p.id) && !children.some(x => x.id === p.id) && !spouses.some(s => s.id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
              <select
                className="bg-sepia-50 border border-sepia-300 rounded flex-1 p-2 text-sm text-sepia-900 focus:outline-none"
                value={selectedRelType}
                onChange={e => setSelectedRelType(e.target.value)}
              >
                <option value="parent">is a Parent</option>
                <option value="stepparent">is a Step-Parent</option>
                <option value="spouse">is a Spouse</option>
                <option value="child">is a Child</option>
                <option value="stepchild">is a Step-Child</option>
              </select>
            </div>
            <button
              onClick={handleAddRelationship}
              disabled={!selectedRelPerson}
              className="w-full py-2 bg-sepia-200 text-sepia-800 rounded font-medium disabled:opacity-50 hover:bg-sepia-300 transition-colors"
            >
              Add Link
            </button>
            <p className="text-xs text-sepia-500 mt-3 italic text-center text-balance">
              Connections will automatically map bidirectionally in the database graph upon saving.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
