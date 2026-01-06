
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Note } from '../types';
import { quickQuery, translateText, speakText } from '../services/geminiService';

interface NoteViewProps {
  notes: Note[];
  onAddNote: (content: string, tags: string[]) => void;
  setNotes: (notes: Note[] | ((prev: Note[]) => Note[]), saveHistory?: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const NoteView: React.FC<NoteViewProps> = ({ 
  notes, 
  onAddNote, 
  setNotes, 
  onUndo, 
  onRedo, 
  canUndo, 
  canRedo 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      const tags = tagInput.split(',').map(t => t.trim()).filter(t => t !== '');
      onAddNote(inputValue, tags);
      setInputValue('');
      setTagInput('');
    }
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    if (window.confirm('Are you sure you want to clear all notes?')) {
      setNotes([]);
    }
  };

  const handleTranslate = async (noteId: string, content: string) => {
    setTranslatingId(noteId);
    try {
      const result = await translateText(content);
      if (result) setTranslations(prev => ({ ...prev, [noteId]: result }));
    } catch (error) { console.error(error); } finally { setTranslatingId(null); }
  };

  const handleQuickSummary = async (noteId: string, content: string) => {
    setSummarizingId(noteId);
    try {
      const result = await quickQuery(`Summarize briefly: "${content}"`);
      if (result) setSummaries(prev => ({ ...prev, [noteId]: result }));
    } catch (error) { console.error(error); } finally { setSummarizingId(null); }
  };

  const handleCopy = (noteId: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(noteId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white">Clippings</h2>
          <p className="text-slate-500 text-xs">Saved from your clipboard automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <button 
              onClick={clearAll}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-red-400 hover:bg-red-500/10 transition-all border border-red-500/20 uppercase tracking-tighter"
            >
              Clear All
            </button>
          )}
          <div className="flex bg-slate-800/40 rounded-xl p-1 border border-white/5">
            <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded-lg text-slate-300 disabled:opacity-20 hover:bg-slate-700 transition-all">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
            </button>
            <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded-lg text-slate-300 disabled:opacity-20 hover:bg-slate-700 transition-all">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg>
            </button>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-slate-800/30 border border-white/5 p-4 rounded-2xl space-y-3">
        <textarea 
          value={inputValue} 
          onChange={(e) => setInputValue(e.target.value)} 
          placeholder="Add a thought manually..." 
          className="w-full h-20 bg-slate-900/60 border border-white/10 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none text-sm"
        />
        <div className="flex gap-2">
          <input 
            type="text" 
            value={tagInput} 
            onChange={(e) => setTagInput(e.target.value)} 
            placeholder="Tags..." 
            className="flex-1 px-3 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-slate-400 focus:outline-none"
          />
          <button type="submit" disabled={!inputValue.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50">Save</button>
        </div>
      </form>

      <div className="space-y-3 pb-20">
        {notes.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl text-slate-600 text-sm italic">
            Clipboard is empty
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="group bg-slate-800/40 border border-white/5 p-4 rounded-2xl hover:bg-slate-800/60 transition-all relative overflow-hidden">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                  
                  {translations[note.id] && (
                    <div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-emerald-100/80 italic">
                      <span className="font-bold text-emerald-500 uppercase text-[9px] mr-2">Translate:</span>
                      {translations[note.id]}
                    </div>
                  )}

                  {summaries[note.id] && (
                    <div className="mt-3 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs text-slate-400">
                      <span className="font-bold text-indigo-400 uppercase text-[9px] mr-2">AI Summary:</span>
                      {summaries[note.id]}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => deleteNote(note.id)} className="p-1.5 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 rounded-lg transition-colors" title="Delete">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                  <button onClick={() => handleTranslate(note.id, note.content)} className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg" title="Translate">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5c1.382 3.307 3.233 6.355 5.49 9.043"/></svg>
                  </button>
                  <button onClick={() => handleCopy(note.id, note.content)} className="p-1.5 hover:bg-slate-700 text-slate-400 rounded-lg" title="Copy">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NoteView;
