
import React from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  compact?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, compact }) => {
  const items = [
    { id: ViewMode.NOTES, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Clippings' },
    { id: ViewMode.READER, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', label: 'Library' },
    { id: ViewMode.STUDIO, icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', label: 'Studio' },
    { id: ViewMode.PROGRESS, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2', label: 'Progress' },
  ];

  return (
    <aside className={`${compact ? 'w-14' : 'w-20'} bg-slate-800/50 flex flex-col items-center py-6 space-y-6 border-r border-white/5 transition-all`}>
      <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg`} title="ZenNote AI">
        <span className={`${compact ? 'text-sm' : 'text-xl'} font-bold`}>Z</span>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveView(item.id)}
          title={item.label}
          className={`p-2.5 rounded-2xl transition-all duration-300 group ${
            activeView === item.id 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`${compact ? 'h-5 w-5' : 'h-6 w-6'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
          </svg>
        </button>
      ))}
    </aside>
  );
};

export default Sidebar;
