import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [recentArtifacts, setRecentArtifacts] = useState([]);
  const [storytellers, setStorytellers] = useState([]);
  const [collections, setCollections] = useState([]);

  // Lineage Stats
  const [personCount, setPersonCount] = useState(0);
  const [linkCount, setLinkCount] = useState(0);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);

        // 1. Fetch Recent Artifacts (Memories with media)
        const { data: artifactsData } = await supabase
          .from('memories')
          .select('id, title, type, start_date, date_text, artifact_url, thumbnail_url')
          .not('artifact_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(6);

        setRecentArtifacts(artifactsData || []);

        // 2. Fetch Key Storytellers (Top 3 persons)
        const { data: personsData } = await supabase
          .from('persons')
          .select('id, display_name, biography, first_name')
          .order('created_at', { ascending: false })
          .limit(3);

        setStorytellers(personsData || []);

        // 3. Fetch Active Threads (Collections)
        const { data: collectionsData } = await supabase
          .from('collections')
          .select('*, memory_collections(memories(artifact_url, thumbnail_url))')
          .order('created_at', { ascending: false })
          .limit(3);

        const colsWithImages = (collectionsData || []).map(col => {
          const memories = col.memory_collections?.map(mc => mc.memories).filter(Boolean) || [];
          const validImages = memories.filter(m => m.artifact_url || m.thumbnail_url).map(m => m.thumbnail_url || m.artifact_url);
          const randomImage = validImages.length > 0 ? validImages[Math.floor(Math.random() * validImages.length)] : null;
          return { ...col, randomImage };
        });

        setCollections(colsWithImages);

        // 4. Fetch Lineage Stats (Totals) // using head: true gives count without returning data
        const { count: pCount } = await supabase
          .from('persons')
          .select('*', { count: 'exact', head: true });

        const { count: relCount } = await supabase
          .from('person_relationships')
          .select('*', { count: 'exact', head: true });

        // Divide relCount by 2 because relationships should be considered conceptually
        // Though in our structure they are bi-directional rows.
        setPersonCount(pCount || 0);
        setLinkCount(relCount ? Math.floor(relCount / 2) : 0);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-black text-navy-muted dark:text-slate-100">Memory Dashboard</h1>
        <p className="text-slate-500 mt-1 italic">"The threads of the past are the fabric of our future."</p>
      </div>

      {/* Memory Threads Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">mediation</span>
            <h2 className="text-xl font-bold text-navy-muted dark:text-slate-100">Active Memory Threads</h2>
          </div>
          <Link to="#" className="text-sm font-semibold text-primary hover:underline">View all threads</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.length === 0 ? (
            <div className="col-span-full border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-8 text-center bg-slate-50 dark:bg-slate-900/50">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">auto_stories</span>
              <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400">No Memory Threads Yet</h3>
              <p className="text-sm text-slate-500 mb-4 text-balance">Group related memories into Collections to track specific family storylines or epochs.</p>
              <button className="text-sm font-bold bg-primary text-white px-4 py-2 rounded-xl shadow-md hover:bg-primary/90 transition-colors">
                Create Collection
              </button>
            </div>
          ) : (
            collections.map((col, i) => {
              // Cycle through the mockup UI colors/styles based on index
              const colorClasses = [
                "border-b-primary",
                "border-b-accent-gold",
                "border-b-primary/40"
              ];
              const bColor = colorClasses[i % colorClasses.length];

              return (
                <Link to={`/collections/${col.id}`} key={col.id} className={`group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all border-b-4 ${bColor} block cursor-pointer`}>
                  <div className="h-48 overflow-hidden relative bg-slate-200 flex items-center justify-center">
                    {col.randomImage ? (
                      <img src={col.randomImage} alt={col.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <span className="material-symbols-outlined text-6xl text-slate-300">auto_awesome_mosaic</span>
                    )}
                    <div className="absolute top-4 left-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter shadow-sm">
                      {format(new Date(col.created_at), 'MMM yyyy')}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{col.name}</h3>
                    <p className="text-slate-500 text-sm mt-2 line-clamp-2 leading-relaxed">{col.description || 'No description provided.'}</p>
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                      <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1 group-hover:text-primary transition-colors">
                        Collection <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* Recent Artifacts Gallery */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">camera_roll</span>
            <h2 className="text-xl font-bold text-navy-muted dark:text-slate-100">Recent Artifacts</h2>
          </div>
          <Link to="/memories" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            See Archive <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {recentArtifacts.map(artifact => (
            <Link key={artifact.id} to={`/memories/${artifact.id}`} className="aspect-square bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden relative group cursor-pointer border-2 border-transparent hover:border-primary transition-all">
              {artifact.type === 'photo' || artifact.type === 'document' ? (
                <img
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                  alt={artifact.title}
                  src={artifact.thumbnail_url || artifact.artifact_url}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100">
                  <span className="material-symbols-outlined text-4xl text-slate-300">
                    {artifact.type === 'video' ? 'videocam' : 'audiotrack'}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <span className="text-[10px] text-white font-medium truncate w-full block">
                  {artifact.title || 'Untitled'}
                  {artifact.date_text ? `, ${artifact.date_text}` : (artifact.start_date ? `, ${artifact.start_date.substring(0, 4)}` : '')}
                </span>
              </div>
            </Link>
          ))}

          {/* Upload Button fills remaining space up to 6 minimum visual blocks, but always show at least one */}
          <Link to="/upload" className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 flex flex-col items-center justify-center group cursor-pointer hover:border-primary transition-all shadow-sm hover:bg-slate-50">
            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">add_a_photo</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 group-hover:text-primary transition-colors">Upload</span>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
        {/* Family Tree Quick Access */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">account_tree</span>
              Family Lineage
            </h2>
            <Link to="#" className="p-2 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-slate-400">fullscreen</span>
            </Link>
          </div>

          <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200">
            <div className="flex items-center justify-center gap-4 mb-5">
              <div className="size-16 rounded-full border-2 border-primary bg-white flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-primary text-2xl">person</span>
              </div>
              <div className="flex flex-col gap-1 items-center">
                <div className="w-12 h-0.5 bg-slate-300"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{linkCount} unique edges</span>
              </div>
              <div className="size-16 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center shadow-sm relative">
                <span className="material-symbols-outlined text-slate-300 text-2xl">person</span>
                <div className="absolute -bottom-1 -right-1 bg-white border border-slate-200 size-6 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-300 text-[10px]">add</span>
                </div>
              </div>
            </div>

            <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">Your Archival Graph</p>
            <p className="text-sm font-medium text-slate-500">{personCount} Integrated Actors • {linkCount} Relationship Nodes</p>

            <Link to="/people" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary px-5 py-2.5 bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors">
              <span>Explore Graph Engine</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Actor Profiles Quick Access */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">groups</span>
              Recent Actors
            </h2>
            <Link to="/people" className="text-sm font-semibold text-primary hover:underline">
              View Directory
            </Link>
          </div>

          <div className="space-y-3 flex-1">
            {storytellers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-70">
                <span className="material-symbols-outlined text-4xl mb-2">person_off</span>
                <p className="text-sm font-medium">No actors indexed yet.</p>
              </div>
            ) : (
              storytellers.map((person, i) => (
                <Link key={person.id} to={`/people/${person.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 group">
                  <div className="flex items-center gap-4">
                    <div className={`size-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm
                      ${i === 0 ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30' :
                        i === 1 ? 'bg-primary/20 text-primary border border-primary/30' :
                          'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                      {person.first_name ? person.first_name.charAt(0) : person.display_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">
                        {person.display_name}
                      </p>
                      <p className="text-xs text-slate-500 line-clamp-1 max-w-[200px]">{person.biography || 'No biography details provided.'}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                </Link>
              ))
            )}

            <Link to="/people" className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-dashed border-slate-300 hover:border-primary/50 group mt-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">person_add</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500 group-hover:text-primary transition-colors">Add New Actor</p>
                  <p className="text-xs text-slate-400">Expand the family lineage</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
