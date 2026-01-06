
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ViewMode, Note } from './types';
import Sidebar from './components/Sidebar';
import NoteView from './components/NoteView';
import StudioView from './components/StudioView';
import MindMapView from './components/MindMapView';
import DashboardView from './components/DashboardView';

// 更加稳健的 IPC 获取方式
const getIpc = () => {
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      const electron = (window as any).require('electron');
      return electron.ipcRenderer;
    } catch (e) {
      console.warn("IPC connection failed. Are you running in a web browser?");
      return null;
    }
  }
  return null;
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [ipc, setIpc] = useState<any>(null);
  
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [notes, setNotesState] = useState<Note[]>(() => {
    const saved = localStorage.getItem('zen_notes');
    return saved ? JSON.parse(saved) : [];
  });

  // 初始化 IPC
  useEffect(() => {
    const renderer = getIpc();
    if (renderer) {
      setIpc(renderer);
      const handleClipboard = (_event: any, text: string) => {
        setNotesState(prev => {
          if (prev.length > 0 && prev[0].content === text) return prev;
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
      renderer.on('clipboard-sync', handleClipboard);
      return () => { renderer.removeAllListeners('clipboard-sync'); };
    }
  }, []);

  // 全局计时器逻辑
  useEffect(() => {
    let timer: any;
    if (isTimerRunning && timerSeconds > 0) {
      timer = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, timerSeconds]);

  useEffect(() => { localStorage.setItem('zen_notes', JSON.stringify(notes)); }, [notes]);

  const handleMin = () => {
    if (ipc) {
      ipc.send('window-min');
    } else {
      console.log("Minimize clicked (Web Simulation)");
    }
  };

  const handleClose = () => {
    if (ipc) {
      ipc.send('window-close');
    } else {
      console.log("Close clicked (Web Simulation)");
    }
  };

  const addNote = (content: string, tags: string[] = []) => {
    const newNote: Note = { id: Date.now().toString(), content, createdAt: Date.now(), tags };
    setNotesState([newNote, ...notes]);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden relative border border-white/10 rounded-2xl shadow-2xl">
      {/* 拖拽区域：置于底层 z-0，按钮置于上层 */}
      <div style={{ WebkitAppRegion: 'drag' } as any} className="absolute top-0 left-0 right-0 h-12 z-0 cursor-move" />
      
      {/* 顶栏控制层：z-50 */}
      <div className="absolute top-0 left-0 right-0 h-12 flex justify-between items-center px-4 z-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest select-none">ZenNote AI</span>
        </div>
        
        <div className="flex space-x-3 items-center pointer-events-auto">
           <button 
             onClick={handleMin}
             className="w-3.5 h-3.5 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors shadow-sm flex items-center justify-center group"
             title="最小化"
           >
             <div className="w-1.5 h-px bg-yellow-900/50 opacity-0 group-hover:opacity-100"></div>
           </button>
           <button 
             onClick={handleClose}
             className="w-3.5 h-3.5 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors shadow-sm flex items-center justify-center group"
             title="隐藏到托盘"
           >
             <div className="w-1.5 h-1.5 opacity-0 group-hover:opacity-100 flex items-center justify-center">
               <svg className="w-2 h-2 text-red-900/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M6 18L18 6M6 6l12 12"/></svg>
             </div>
           </button>
        </div>
      </div>

      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      <main className="flex-1 overflow-y-auto pt-14 pb-4 px-6 custom-scrollbar bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30">
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
