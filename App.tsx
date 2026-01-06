
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ViewMode, Note } from './types';
import Sidebar from './components/Sidebar';
import NoteView from './components/NoteView';
import StudioView from './components/StudioView';
import MindMapView from './components/MindMapView';
import DashboardView from './components/DashboardView';

const getIpc = () => {
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      return (window as any).require('electron').ipcRenderer;
    } catch (e) { return null; }
  }
  return null;
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const ipc = getIpc();
  
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [notes, setNotesState] = useState<Note[]>(() => {
    const saved = localStorage.getItem('zen_notes');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (ipc) {
      const handleClipboard = (_event: any, text: string) => {
        setNotesState(prev => {
          const newNote: Note = {
            id: Date.now().toString(),
            content: text,
            createdAt: Date.now(),
            tags: ['剪贴板'],
          };
          const updated = [newNote, ...prev];
          localStorage.setItem('zen_notes', JSON.stringify(updated));
          return updated;
        });
      };
      ipc.on('clipboard-sync', handleClipboard);
      return () => { ipc.removeAllListeners('clipboard-sync'); };
    }
  }, [ipc]);

  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      const timer = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isTimerRunning, timerSeconds]);

  useEffect(() => { localStorage.setItem('zen_notes', JSON.stringify(notes)); }, [notes]);

  const addNote = (content: string, tags: string[] = []) => {
    const newNote: Note = { id: Date.now().toString(), content, createdAt: Date.now(), tags };
    setNotesState([newNote, ...notes]);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden relative border border-white/10 rounded-xl shadow-2xl">
      <div style={{ WebkitAppRegion: 'drag' } as any} className="absolute top-0 left-0 right-0 h-10 z-[60] cursor-move" />
      
      <div className="absolute top-0 left-0 right-0 h-10 flex justify-between items-center px-4 z-[70] pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-lg animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ZenNote AI</span>
        </div>
        <div className="flex space-x-2 items-center pointer-events-auto">
           <button onClick={() => ipc?.send('window-min')} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:brightness-110" />
           <button onClick={() => ipc?.send('window-close')} className="w-3 h-3 rounded-full bg-red-500/80 hover:brightness-110" />
        </div>
      </div>

      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      <main className="flex-1 overflow-y-auto pt-12 pb-4 px-6 custom-scrollbar bg-gradient-to-br from-slate-900 to-indigo-950/20">
        {activeView === ViewMode.DASHBOARD && (
          <DashboardView timerSeconds={timerSeconds} setTimerSeconds={setTimerSeconds} isRunning={isTimerRunning} setIsRunning={setIsTimerRunning} />
        )}
        {activeView === ViewMode.NOTES && (
          <NoteView notes={notes} onAddNote={addNote} setNotes={setNotesState} onUndo={()=>{}} onRedo={()=>{}} canUndo={false} canRedo={false} />
        )}
        {activeView === ViewMode.STUDIO && <StudioView />}
        {activeView === ViewMode.MINDMAP && <MindMapView />}
      </main>
    </div>
  );
};

export default App;
