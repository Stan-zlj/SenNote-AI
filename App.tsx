
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ViewMode, Note, DailyCheckIn, Book } from './types';
import Sidebar from './components/Sidebar';
import NoteView from './components/NoteView';
import ReaderView from './components/ReaderView';
import StudioView from './components/StudioView';
import ProgressView from './components/ProgressView';

// Helper component for highlighting search queries
const HighlightText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-indigo-500/40 text-indigo-100 px-0.5 rounded border border-indigo-400/30">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
};

const App: React.FC = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false); // New Floating Mode
  const [activeView, setActiveView] = useState<ViewMode>(ViewMode.NOTES);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [notes, setNotesState] = useState<Note[]>(() => {
    const saved = localStorage.getItem('zen_notes');
    return saved ? JSON.parse(saved) : [];
  });
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

  const toggleNoteStyle = (id: string, styleKey: 'bold' | 'italic' | 'underline') => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, style: { ...n.style, [styleKey]: !n.style?.[styleKey] } } : n));
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
        <div className="absolute -top-12 right-0 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Restore ZenNote</div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`flex h-screen transition-all duration-700 bg-slate-900/95 text-slate-100 overflow-hidden ${isCompactMode ? 'w-[450px] fixed top-4 right-4 rounded-3xl border-2 border-indigo-500/30' : 'w-full rounded-xl border border-white/10'} shadow-2xl backdrop-blur-xl`}>
      <div className="absolute top-0 left-0 right-0 h-12 flex justify-between items-center px-4 z-50 bg-slate-950/40 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isCompactMode ? 'Floating Note' : 'ZenNote AI'}</span>
        </div>

        {!isCompactMode && (
          <div className="flex-1 max-w-md px-4 pointer-events-auto">
            <div className="relative group">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Global search..."
                className="block w-full pl-10 pr-10 py-1 bg-slate-800/50 border border-white/10 rounded-full text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
            </div>
          </div>
        )}

        <div className="flex space-x-2 pointer-events-auto items-center">
          <button onClick={() => setIsCompactMode(!isCompactMode)} className={`p-1 rounded-md transition-colors ${isCompactMode ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-white'}`} title="Toggle Floating Mode">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <button onClick={() => setIsMinimized(true)} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400" />
          <button className="w-3 h-3 rounded-full bg-red-500/80" />
        </div>
      </div>

      <Sidebar activeView={activeView} setActiveView={setActiveView} compact={isCompactMode} />

      <main className={`flex-1 overflow-y-auto pt-16 pb-6 px-6 relative custom-scrollbar`}>
        {searchQuery.trim() && !isCompactMode ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8 max-w-4xl mx-auto">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Search Results</h2>
                <p className="text-slate-400 text-sm">Matches found for "<span className="text-indigo-400">{searchQuery}</span>"</p>
              </div>
              <button onClick={() => setSearchQuery('')} className="text-xs text-slate-500 border border-white/5 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all">Exit Search</button>
            </header>
            {/* Search result items mapping */}
          </div>
        ) : (
          <>
            {activeView === ViewMode.NOTES && (
              <NoteView notes={notes} onAddNote={addNote} setNotes={setNotes} onToggleStyle={toggleNoteStyle} onUndo={undoNotes} onRedo={redoNotes} canUndo={pastNotes.length > 0} canRedo={futureNotes.length > 0} />
            )}
            {activeView === ViewMode.READER && (
              <ReaderView books={books} setBooks={setBooks} />
            )}
            {activeView === ViewMode.STUDIO && (
              <StudioView onSaveToLibrary={addBook} onSaveNote={addNote} />
            )}
            {activeView === ViewMode.PROGRESS && (
              <ProgressView checkIns={checkIns} toggleCheckIn={toggleCheckIn} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
