
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ViewMode, Note, DailyCheckIn, Book } from './types';
import Sidebar from './components/Sidebar';
import NoteView from './components/NoteView';
import ReaderView from './components/ReaderView';
import StudioView from './components/StudioView';
import ProgressView from './components/ProgressView';

// 拖拽手柄组件 (Electron 专用)
const DragHandle = () => (
  <div style={{ WebkitAppRegion: 'drag' } as any} className="absolute top-0 left-0 right-0 h-8 cursor-move z-[60] flex items-center justify-center group">
    <div className="w-12 h-1 bg-white/10 rounded-full group-hover:bg-white/30 transition-all"></div>
  </div>
);

const HighlightText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-indigo-500/40 text-indigo-100 px-0.5 rounded border border-indigo-400/30 font-medium">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
};

const App: React.FC = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(true); // 默认开启悬浮模式
  const [activeView, setActiveView] = useState<ViewMode>(ViewMode.NOTES);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [notes, setNotesState] = useState<Note[]>(() => {
    const saved = localStorage.getItem('zen_notes');
    return saved ? JSON.parse(saved) : [];
  });
  
  // 监听 Electron 剪贴板同步
  useEffect(() => {
    if ((window as any).ipcRenderer) {
      const ipc = (window as any).ipcRenderer;
      ipc.on('clipboard-sync', (event: any, text: string) => {
        // 如果内容不在最新笔记中，则添加
        setNotesState(prev => {
          if (prev[0]?.content === text) return prev;
          const newNote: Note = {
            id: Date.now().toString(),
            content: text,
            createdAt: Date.now(),
            tags: ['Auto-Copy'],
            style: { bold: false, italic: false, underline: false }
          };
          const updated = [newNote, ...prev];
          localStorage.setItem('zen_notes', JSON.stringify(updated));
          return updated;
        });
      });
    }
  }, []);

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

  const undoNotes = useCallback(() => {
    if (pastNotes.length === 0) return;
    const previous = pastNotes[pastNotes.length - 1];
    setFutureNotes(prev => [notes, ...prev]);
    setPastNotes(pastNotes.slice(0, pastNotes.length - 1));
    setNotesState(previous);
  }, [pastNotes, notes]);

  const redoNotes = useCallback(() => {
    if (futureNotes.length === 0) return;
    const next = futureNotes[0];
    setPastNotes(prev => [...prev, notes]);
    setFutureNotes(futureNotes.slice(1));
    setNotesState(next);
  }, [futureNotes, notes]);

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

  const addBook = (bookData: Omit<Book, 'id'>) => {
    setBooks([{ ...bookData, id: Date.now().toString() }, ...books]);
  };

  const toggleCheckIn = () => {
    const today = new Date().toISOString().split('T')[0];
    const existing = checkIns.find(c => c.date === today);
    if (existing) setCheckIns(checkIns.filter(c => c.date !== today));
    else setCheckIns([...checkIns, { date: today, status: true, notes: '' }]);
  };

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return { notes: [], books: [] };
    const q = searchQuery.toLowerCase();
    return {
      notes: notes.filter(n => n.content.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q))),
      books: books.filter(b => b.title.toLowerCase().includes(q) || b.contentSnippet.toLowerCase().includes(q))
    };
  }, [searchQuery, notes, books]);

  if (isMinimized) {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center cursor-pointer shadow-2xl hover:scale-110 transition-all border-2 border-white/20 z-50 group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5" /></svg>
      </div>
    );
  }

  return (
    <div className={`flex h-screen transition-all duration-700 bg-slate-900 text-slate-100 overflow-hidden ${isCompactMode ? 'w-full rounded-none border-none' : 'w-full rounded-xl border border-white/10'} backdrop-blur-xl relative`}>
      <DragHandle />
      
      <div className="absolute top-0 left-0 right-0 h-12 flex justify-between items-center px-4 z-50 bg-slate-950/40 border-b border-white/5">
        <div className="flex items-center gap-2 pt-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Companion</span>
        </div>
        <div className="flex space-x-2 items-center pt-2">
           <button onClick={() => setIsMinimized(true)} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors" />
           <button onClick={() => { if(window.close) window.close(); }} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors" />
        </div>
      </div>

      <Sidebar activeView={activeView} setActiveView={setActiveView} compact={true} />

      <main className="flex-1 overflow-y-auto pt-16 pb-6 px-4 relative custom-scrollbar bg-[#0f172a]">
          <>
            {activeView === ViewMode.NOTES && <NoteView notes={notes} onAddNote={addNote} setNotes={setNotes} onUndo={undoNotes} onRedo={redoNotes} canUndo={pastNotes.length > 0} canRedo={futureNotes.length > 0} />}
            {activeView === ViewMode.READER && <ReaderView books={books} setBooks={setBooks} />}
            {activeView === ViewMode.STUDIO && <StudioView onSaveToLibrary={addBook} onSaveNote={addNote} />}
            {activeView === ViewMode.PROGRESS && <ProgressView checkIns={checkIns} toggleCheckIn={toggleCheckIn} />}
          </>
      </main>
    </div>
  );
};

export default App;
