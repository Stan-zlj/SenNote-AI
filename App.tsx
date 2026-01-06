
import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, Note, DailyCheckIn, Book } from './types';
import Sidebar from './components/Sidebar';
import NoteView from './components/NoteView';
import ReaderView from './components/ReaderView';
import StudioView from './components/StudioView';
import ProgressView from './components/ProgressView';

// 获取 Electron 实例
const getIpc = () => {
  try {
    return (window as any).require ? (window as any).require('electron').ipcRenderer : null;
  } catch (e) {
    return null;
  }
};

// 拖拽手柄：-webkit-app-region: drag 是 Electron 窗口可拖拽的关键
const DragHandle = () => (
  <div 
    style={{ WebkitAppRegion: 'drag' } as any} 
    className="absolute top-0 left-0 right-0 h-12 z-[60] flex items-center justify-center group cursor-move"
  >
    <div className="w-16 h-1.5 bg-white/10 rounded-full group-hover:bg-white/30 transition-all mt-1 shadow-inner"></div>
  </div>
);

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>(ViewMode.NOTES);
  const ipc = getIpc();
  
  const [notes, setNotesState] = useState<Note[]>(() => {
    const saved = localStorage.getItem('zen_notes');
    return saved ? JSON.parse(saved) : [];
  });
  
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
      return () => {
        ipc.removeAllListeners('clipboard-sync');
      };
    }
  }, [ipc]);

  const [pastNotes, setPastNotes] = useState<Note[][]>([]);
  const [futureNotes, setFutureNotes] = useState<Note[][]>([]);
  const [checkIns, setCheckIns] = useState<DailyCheckIn[]>(() => {
    const saved = localStorage.getItem('zen_checkins');
    return saved ? JSON.parse(saved) : [];
  });
  const [books, setBooks] = useState<Book[]>(() => {
    const saved = localStorage.getItem('zen_books');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('zen_notes', JSON.stringify(notes));
    localStorage.setItem('zen_checkins', JSON.stringify(checkIns));
    localStorage.setItem('zen_books', JSON.stringify(books));
  }, [notes, checkIns, books]);

  const setNotes = useCallback((newNotes: Note[] | ((prev: Note[]) => Note[]), saveHistory = true) => {
    if (saveHistory) {
      setPastNotes(prev => [...prev.slice(-19), notes]);
      setFutureNotes([]);
    }
    setNotesState(typeof newNotes === 'function' ? newNotes(notes) : newNotes);
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
      
      {/* 顶部标题栏 */}
      <div className="absolute top-0 left-0 right-0 h-12 flex justify-between items-center px-4 z-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">ZenNote AI</span>
        </div>
        <div className="flex space-x-3 items-center pointer-events-auto">
           <button 
             onClick={() => ipc?.send('window-min')} 
             className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-all hover:scale-110 shadow-lg" 
             title="最小化"
           />
           <button 
             onClick={() => ipc?.send('window-close')} 
             className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-all hover:scale-110 shadow-lg" 
             title="关闭"
           />
        </div>
      </div>

      <Sidebar activeView={activeView} setActiveView={setActiveView} compact={true} />

      <main className="flex-1 overflow-y-auto pt-14 pb-4 px-4 custom-scrollbar bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20">
        {activeView === ViewMode.NOTES && <NoteView notes={notes} onAddNote={addNote} setNotes={setNotes} onUndo={undoNotes} onRedo={redoNotes} canUndo={pastNotes.length > 0} canRedo={futureNotes.length > 0} />}
        {activeView === ViewMode.READER && <ReaderView books={books} setBooks={setBooks} />}
        {activeView === ViewMode.STUDIO && <StudioView onSaveToLibrary={(b) => setBooks([ {...b, id: Date.now().toString()}, ...books])} onSaveNote={addNote} />}
        {activeView === ViewMode.PROGRESS && <ProgressView checkIns={checkIns} toggleCheckIn={() => {
          const today = new Date().toISOString().split('T')[0];
          setCheckIns(prev => prev.some(c => c.date === today) ? prev.filter(c => c.date !== today) : [...prev, {date: today, status: true, notes: ''}]);
        }} />}
      </main>
    </div>
  );
};

export default App;
