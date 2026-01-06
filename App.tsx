
import React, { useState, useEffect } from 'react';
import { ViewMode, Note, DailyCheckIn, Book } from './types';
import Sidebar from './components/Sidebar';
import NoteView from './components/NoteView';
import ReaderView from './components/ReaderView';
import StudioView from './components/StudioView';
import ProgressView from './components/ProgressView';

const App: React.FC = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>(ViewMode.NOTES);
  const [notes, setNotes] = useState<Note[]>(() => {
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

  useEffect(() => {
    localStorage.setItem('zen_notes', JSON.stringify(notes));
    localStorage.setItem('zen_checkins', JSON.stringify(checkIns));
    localStorage.setItem('zen_books', JSON.stringify(books));
  }, [notes, checkIns, books]);

  const addNote = (content: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      content,
      createdAt: Date.now(),
      tags: []
    };
    setNotes([newNote, ...notes]);
  };

  const addBook = (bookData: Omit<Book, 'id'>) => {
    const newBook: Book = {
      ...bookData,
      id: Date.now().toString()
    };
    setBooks([newBook, ...books]);
  };

  const toggleCheckIn = () => {
    const today = new Date().toISOString().split('T')[0];
    const existing = checkIns.find(c => c.date === today);
    if (existing) {
      setCheckIns(checkIns.filter(c => c.date !== today));
    } else {
      setCheckIns([...checkIns, { date: today, status: true, notes: '' }]);
    }
  };

  if (isMinimized) {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center cursor-pointer shadow-2xl hover:bg-indigo-700 transition-all border-2 border-white/20 animate-pulse z-50"
        title="Restore ZenNote"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-900/95 text-slate-100 overflow-hidden rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl">
      {/* Fake Titlebar for Desktop Look */}
      <div className="absolute top-0 left-0 right-0 h-10 flex justify-between items-center px-4 z-50 bg-slate-950/20 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ZenNote AI Workspace</span>
        </div>
        <div className="flex space-x-2 pointer-events-auto">
          <button onClick={() => setIsMinimized(true)} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors" title="Minimize to Widget" />
          <button className="w-3 h-3 rounded-full bg-red-500/80" title="Close Workspace" />
        </div>
      </div>

      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      <main className="flex-1 overflow-y-auto pt-14 pb-6 px-6 relative">
        {activeView === ViewMode.NOTES && (
          <NoteView notes={notes} onAddNote={addNote} setNotes={setNotes} />
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
      </main>
    </div>
  );
};

export default App;
