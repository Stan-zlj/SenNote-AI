
import React, { useState } from 'react';
import { Note } from '../types';
import { deepAnalysis, speakText, quickQuery } from '../services/geminiService';

interface NoteViewProps {
  notes: Note[];
  onAddNote: (content: string) => void;
  setNotes: (notes: Note[]) => void;
}

const NoteView: React.FC<NoteViewProps> = ({ notes, onAddNote, setNotes }) => {
  const [inputValue, setInputValue] = useState('');
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [deepInsights, setDeepInsights] = useState<Record<string, string>>({});
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onAddNote(inputValue);
      setInputValue('');
    }
  };

  const handleDeepAnalyze = async (noteId: string, text: string) => {
    setLoadingIds(prev => new Set(prev).add(noteId));
    try {
      const result = await deepAnalysis([{ text }]);
      if (result) {
        setDeepInsights(prev => ({ ...prev, [noteId]: result }));
      }
    } catch (error) {
      console.error("Deep analysis failed", error);
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
  };

  const handleQuickSummary = async (noteId: string, content: string) => {
    setSummarizingId(noteId);
    try {
      const result = await quickQuery(`Summarize this note briefly in 1-2 sentences: "${content}"`);
      if (result) {
        setSummaries(prev => ({ ...prev, [noteId]: result }));
      }
    } catch (error) {
      console.error("Failed to summarize note", error);
    } finally {
      setSummarizingId(null);
    }
  };

  const handleSpeak = (text: string) => {
    speakText(text);
  };

  const handleCopy = (noteId: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(noteId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const confirmDelete = () => {
    if (noteToDelete) {
      setNotes(notes.filter(n => n.id !== noteToDelete));
      setNoteToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Clippings Vault</h2>
          <p className="text-slate-400 text-sm">Paste study materials here for AI analysis.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="relative group">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Paste something you're studying right now..."
          className="w-full h-32 bg-slate-800/40 border border-white/10 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none shadow-inner"
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="absolute bottom-3 right-3 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-lg disabled:opacity-50 hover:scale-105 active:scale-95"
        >
          Clip Content
        </button>
      </form>

      <div className="space-y-4 pb-10">
        {notes.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl">
            <p className="text-slate-500 text-sm">No clippings yet. Paste content above to begin.</p>
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="group bg-slate-800/30 border border-white/5 p-5 rounded-2xl hover:bg-slate-800/50 transition-all shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex-1 overflow-hidden">
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  
                  {summaries[note.id] && (
                    <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl animate-in slide-in-from-left-2 duration-300">
                      <div className="flex items-center gap-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">AI Summary</span>
                      </div>
                      <p className="text-slate-400 text-xs italic leading-relaxed">{summaries[note.id]}</p>
                    </div>
                  )}

                  {deepInsights[note.id] && (
                    <div className="mt-4 p-5 bg-purple-500/10 border border-purple-500/20 rounded-xl animate-in slide-in-from-top-2 duration-500 shadow-lg">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                          </svg>
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Deep Insight Analysis</span>
                        </div>
                        <button onClick={() => handleSpeak(deepInsights[note.id])} className="text-[10px] text-indigo-400 hover:text-white font-bold flex items-center gap-1 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                          LISTEN
                        </button>
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{deepInsights[note.id]}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col space-y-3 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleCopy(note.id, note.content)} className={`p-2 rounded-lg transition-all ${copiedId === note.id ? 'bg-green-500/20 text-green-400 scale-110' : 'hover:bg-slate-700 text-slate-400'}`} title="Copy to Clipboard">
                    {copiedId === note.id ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    )}
                  </button>
                  <button onClick={() => handleSpeak(note.content)} className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-all" title="Read Aloud">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  </button>
                  <button 
                    onClick={() => handleQuickSummary(note.id, note.content)} 
                    disabled={summarizingId === note.id}
                    className={`p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-all ${summarizingId === note.id ? 'animate-pulse scale-90' : ''}`} 
                    title="Quick AI Summary"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => handleDeepAnalyze(note.id, note.content)} 
                    disabled={loadingIds.has(note.id)} 
                    className={`p-2 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-all ${loadingIds.has(note.id) ? 'animate-pulse scale-90' : ''}`} 
                    title="Deep AI Insight (Thinking Mode)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                  </button>
                  <button onClick={() => setNoteToDelete(note.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-all" title="Archive Clipping">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Dialog */}
      {noteToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Delete Clipping?</h3>
            <p className="text-slate-400 text-sm mb-6">This note will be permanently removed from your workspace.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setNoteToDelete(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-lg shadow-red-600/20">Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteView;
