import { BrowserRouter, Routes, Route, Outlet, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Memories from './pages/Memories';
import MemoryDetail from './pages/MemoryDetail';
import People from './pages/People';
import PersonDetail from './pages/PersonDetail';
import UploadWorkflow from './pages/Upload';

function AppLayout() {
  const location = useLocation();
  const navItems = [
    { label: 'Dashboard', icon: 'dashboard', path: '/' },
    { label: 'Family Tree', icon: 'account_tree', path: '/tree' },
    { label: 'Actor Profiles', icon: 'groups', path: '/people' },
    { label: 'Archives', icon: 'folder_shared', path: '/archives' },
  ];
  
  const collectionsItems = [
    { label: 'Woven Stories', icon: 'history_edu', path: '/stories' },
    { label: 'Artifact Gallery', icon: 'photo_library', path: '/memories' },
  ];

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-primary/10 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined">auto_stories</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-primary">Memory Weaver</h2>
          </div>
          
          <nav className="flex-1 px-4 mt-4 space-y-6 overflow-y-auto">
            <div className="space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div>
               <div className="pt-4 pb-2 px-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Collections</div>
               <div className="space-y-2">
                 {collectionsItems.map((item) => {
                   const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                   return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                   );
                 })}
               </div>
            </div>
          </nav>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 p-2">
              <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary">person</span>
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">Julian Thorne</p>
                <p className="text-xs text-slate-500 truncate">Digital Archivist</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-y-auto parchment-texture relative">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-primary/10 px-8 py-4 flex items-center justify-between">
            <div className="relative w-96">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input 
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm outline-none" 
                placeholder="Search ancestors, artifacts, or threads..." 
                type="text"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="size-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-primary transition-colors">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <Link to="/upload" className="bg-primary text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">
                <span className="material-symbols-outlined text-lg">add</span>
                New Memory
              </Link>
            </div>
          </header>

          <div className="flex-1 p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="memories" element={<Memories />} />
          <Route path="memories/:id" element={<MemoryDetail />} />
          <Route path="people" element={<People />} />
          <Route path="people/:id" element={<PersonDetail />} />
          <Route path="upload" element={<UploadWorkflow />} />
          <Route path="settings" element={<div className="text-center p-12 text-sepia-600">Settings and Trust Groups configuration</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
