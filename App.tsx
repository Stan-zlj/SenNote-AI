
import React, { useState, useEffect } from 'react';
import { ViewMode, Note } from './types';
import Sidebar from './components/Sidebar';
import NoteView from './components/NoteView';
import StudioView from './components/StudioView';
import MindMapView from './components/MindMapView';
import DashboardView from './components/DashboardView';
import ChatBotView from './components/ChatBotView';
import LiveChatView from './components/LiveChatView';

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
          if (prev.length > 0 && prev[0].content === text) return prev;
          const newNote: Note = { id: Date.now().toString(), content: text, createdAt: Date.now(), tags: ['剪贴板'] };
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
    let timer: any;
    if (isTimerRunning && timerSeconds > 0) {
      timer = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, timerSeconds]);

  const handleMin = () => ipc ? ipc.send('window-min') : console.log("Min");
  const handleClose = () => ipc ? ipc.send('window-close') : console.log("Hide");

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden relative border border-white/10 rounded-2xl shadow-2xl">
      <div style={{ WebkitAppRegion: 'drag' } as any} className="absolute top-0 left-0 right-0 h-12 z-0 cursor-move" />
      
      <div className="absolute top-0 left-0 right-0 h-12 flex justify-between items-center px-4 z-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ZenNote AI</span>
        </div>
        
        <div className="flex space-x-3 items-center pointer-events-auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
           <button 
             onClick={handleMin}
             className="w-3.5 h-3.5 rounded-full bg-yellow-500/80 hover:brightness-110 active:scale-90 transition-all"
             title="最小化"
           />
           <button 
             onClick={handleClose}
             className="w-3.5 h-3.5 rounded-full bg-red-500/80 hover:brightness-110 active:scale-90 transition-all"
             title="隐藏到托盘"
           />
        </div>
      </div>

      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      <main className="flex-1 overflow-y-auto pt-14 pb-4 px-6 custom-scrollbar bg-gradient-to-br from-slate-900 to-indigo-950/20">
        {activeView === ViewMode.DASHBOARD && (
          <DashboardView timerSeconds={timerSeconds} setTimerSeconds={setTimerSeconds} isRunning={isTimerRunning} setIsRunning={setIsTimerRunning} />
        )}
        {activeView === ViewMode.NOTES && (
          <NoteView notes={notes} onAddNote={(c, t) => setNotesState([{id: Date.now().toString(), content: c, createdAt: Date.now(), tags: t}, ...notes])} setNotes={setNotesState} onUndo={()=>{}} onRedo={()=>{}} canUndo={false} canRedo={false} />
        )}
        {activeView === ViewMode.CHAT && <ChatBotView />}
        {activeView === ViewMode.LIVE && <LiveChatView />}
        {activeView === ViewMode.STUDIO && <StudioView />}
        {activeView === ViewMode.MINDMAP && <MindMapView />}
      </main>
    </div>
  );
};

export default App;
