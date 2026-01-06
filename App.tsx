
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ViewMode, Note, DailyCheckIn, Book } from './types';
import Sidebar from './components/Sidebar';
import NoteView from './components/NoteView';
import ReaderView from './components/ReaderView';
import StudioView from './components/StudioView';
import ProgressView from './components/ProgressView';
import DashboardView from './components/DashboardView';

const getIpc = () => {
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      return (window as any).require('electron').ipcRenderer;
    } catch (e) {
      return null;
    }
  }
  return null;
};

const DragHandle = () => (
  <div 
    style={{ WebkitAppRegion: 'drag' } as any} 
    className="absolute top-0 left-0 right-0 h-12 z-[60] flex items-center justify-center group cursor-move"
  >
    <div className="w-16 h-1 bg-white/5 rounded-full group-hover:bg-white/20 transition-all mt-2"></div>
  </div>
);

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const ipc = getIpc();
  
  // 全局计时器状态 (持久化)
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [notes, setNotesState] = useState<Note[]>(() => {
    const saved = localStorage.getItem('zen_notes');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [checkIns, setCheckIns] = useState<DailyCheckIn[]>(() => {
    const saved = localStorage.getItem('zen_checkins');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [books, setBooks] = useState<Book[]>(() => {
    const saved = localStorage.getItem('zen_books');
    return saved ? JSON.parse(saved) : [];
  });

  const [pastNotes, setPastNotes] = useState<Note[][]>([]);
  const [futureNotes, setFutureNotes] = useState<Note[][]>([]);

  // 播放铃声函数
  const playAlert = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log("Audio play blocked", e));
  };

  // 全局计时器逻辑
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            playAlert();
            // 自动记录一次学习进度
            const today = new Date().toISOString().split('T')[0];
            setCheckIns(curr => curr.some(c => c.date === today) ? curr : [...curr, {date: today, status: true, notes: 'Completed Study Session'}]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning, timerSeconds]);

  useEffect(() => {
    if (ipc) {
      const handleClipboard = (_event: any, text: string) => {
        setNotesState(prev => {
          if (prev.length > 0 && prev[0].content === text) return prev;
          const newNote: Note = {
            id: Date.now().toString(),
            content: text,
            createdAt: Date.now(),
            tags: ['剪贴板'],
            style: { bold: false, italic: false, underline: false }
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

  useEffect(() => { localStorage.setItem('zen_notes', JSON.stringify(notes)); }, [notes]);
  useEffect(() => { localStorage.setItem('zen_checkins', JSON.stringify(checkIns)); }, [checkIns]);
  useEffect(() => { localStorage.setItem('zen_books', JSON.stringify(books)); }, [books]);

  const setNotes = useCallback((newNotes: Note[] | ((prev: Note[]) => Note[]), saveHistory = true) => {
    if (saveHistory) {
      setPastNotes(prev => [...prev.slice(-19), notes]);
      setFutureNotes([]);
    }
    const nextNotes = typeof newNotes === 'function' ? newNotes(notes) : newNotes;
    setNotesState(nextNotes);
  }, [notes]);

  const addNote = (content: string, tags: string[] = []) => {
    const newNote: Note = {
      id: Date.now().toString(),
      content,
      createdAt: Date.now(),
      tags,
      style: { bold: false, italic: false, underline: false }
    };
    setNotes([newNote, ...notes]);
  };

  const undoNotes = () => {
    if (pastNotes.length === 0) return;
    const previous = pastNotes[pastNotes.length - 1];
    setFutureNotes(prev => [notes, ...prev]);
    setPastNotes(pastNotes.slice(0, pastNotes.length - 1));
    setNotesState(previous);
  };

  const redoNotes = () => {
    if (futureNotes.length === 0) return;
    const next = futureNotes[0];
    setPastNotes(prev => [...prev, notes]);
    setFutureNotes(futureNotes.slice(1));
    setNotesState(next);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden relative border border-white/10 rounded-xl shadow-2xl">
      <DragHandle />
      
      <div className="absolute top-0 left-0 right-0 h-12 flex justify-between items-center px-4 z-[70] pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ZenNote AI 学习助手</span>
        </div>
        <div className="flex space-x-3 items-center pointer-events-auto">
           <button 
             onClick={() => ipc?.send('window-min')} 
             className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] hover:brightness-110 shadow-lg border border-black/10 flex items-center justify-center group"
             title="最小化"
           >
             <div className="w-1.5 h-[1.5px] bg-black/30 opacity-0 group-hover:opacity-100"></div>
           </button>
           <button 
             onClick={() => ipc?.send('window-close')} 
             className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:brightness-110 shadow-lg border border-black/10 flex items-center justify-center group"
             title="隐藏到托盘"
           >
             <div className="w-1.5 h-1.5 opacity-0 group-hover:opacity-100 flex items-center justify-center">
               <svg className="w-1.5 h-1.5 text-black/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M6 18L18 6M6 6l12 12"/></svg>
             </div>
           </button>
        </div>
      </div>

      <Sidebar activeView={activeView} setActiveView={setActiveView} compact={true} />

      <main className="flex-1 overflow-y-auto pt-14 pb-4 px-6 custom-scrollbar bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20">
        {activeView === ViewMode.DASHBOARD && (
          <DashboardView 
            timerSeconds={timerSeconds} 
            setTimerSeconds={setTimerSeconds} 
            isRunning={isTimerRunning} 
            setIsRunning={setIsTimerRunning} 
          />
        )}
        {activeView === ViewMode.NOTES && (
          <NoteView 
            notes={notes} 
            onAddNote={addNote} 
            setNotes={setNotes} 
            onUndo={undoNotes} 
            onRedo={redoNotes} 
            canUndo={pastNotes.length > 0} 
            canRedo={futureNotes.length > 0} 
          />
        )}
        {activeView === ViewMode.READER && <ReaderView books={books} setBooks={setBooks} />}
        {activeView === ViewMode.STUDIO && <StudioView onSaveToLibrary={(b) => setBooks([ {...b, id: Date.now().toString()}, ...books])} onSaveNote={addNote} />}
        {activeView === ViewMode.PROGRESS && <ProgressView checkIns={checkIns} toggleCheckIn={() => {
          const today = new Date().toISOString().split('T')[0];
          setCheckIns(prev => prev.some(c => c.date === today) ? prev.filter(c => c.date !== today) : [...prev, {date: today, status: true, notes: 'Manual Log'}]);
        }} />}
      </main>
    </div>
  );
};

export default App;
