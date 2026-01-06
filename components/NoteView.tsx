
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Note } from '../types';
import { deepAnalysis, speakText, quickQuery, translateText } from '../services/geminiService';

interface NoteViewProps {
  notes: Note[];
  onAddNote: (content: string, tags: string[]) => void;
  setNotes: (notes: Note[] | ((prev: Note[]) => Note[]), saveHistory?: boolean) => void;
  onToggleStyle?: (id: string, styleKey: 'bold' | 'italic' | 'underline') => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const NoteView: React.FC<NoteViewProps> = ({ 
  notes, 
  onAddNote, 
  setNotes, 
  onToggleStyle, 
  onUndo, 
  onRedo, 
  canUndo, 
  canRedo 
}) => {
  const [inputValue, setInputValue] = useState(() => localStorage.getItem('zen_note_draft_content') || '');
  const [tagInput, setTagInput] = useState(() => localStorage.getItem('zen_note_draft_tags') || '');
  const [draftHistory, setDraftHistory] = useState<{content: string, tags: string}[]>([]);
  const [draftFuture, setDraftFuture] = useState<{content: string, tags: string}[]>([]);
  const lastSavedDraft = useRef({ content: inputValue, tags: tagInput });
  
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [translations, setTranslations] = useState<Record<string, string>>({}); // New translation state
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [deepInsights, setDeepInsights] = useState<Record<string, string>>({});
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isManagingTags, setIsManagingTags] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [tagSearchModalQuery, setTagSearchModalQuery] = useState('');

  useEffect(() => {
    localStorage.setItem('zen_note_draft_content', inputValue);
    localStorage.setItem('zen_note_draft_tags', tagInput);
    const timeout = setTimeout(() => {
      if (inputValue !== lastSavedDraft.current.content || tagInput !== lastSavedDraft.current.tags) {
        setDraftHistory(prev => [...prev.slice(-19), { ...lastSavedDraft.current }]);
        setDraftFuture([]);
        lastSavedDraft.current = { content: inputValue, tags: tagInput };
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [inputValue, tagInput]);

  const undoDraft = useCallback(() => {
    if (draftHistory.length === 0) return;
    const prev = draftHistory[draftHistory.length - 1];
    setDraftFuture(f => [{ content: inputValue, tags: tagInput }, ...f]);
    setDraftHistory(h => h.slice(0, h.length - 1));
    setInputValue(prev.content);
    setTagInput(prev.tags);
    lastSavedDraft.current = prev;
  }, [draftHistory, inputValue, tagInput]);

  const redoDraft = useCallback(() => {
    if (draftFuture.length === 0) return;
    const next = draftFuture[0];
    setDraftHistory(h => [...h, { content: inputValue, tags: tagInput }]);
    setDraftFuture(f => f.slice(1));
    setInputValue(next.content);
    setTagInput(next.tags);
    lastSavedDraft.current = next;
  }, [draftFuture, inputValue, tagInput]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      const tags = tagInput.split(',').map(t => t.trim()).filter(t => t !== '');
      onAddNote(inputValue, tags);
      setInputValue('');
      setTagInput('');
      setDraftHistory([]);
      setDraftFuture([]);
      localStorage.removeItem('zen_note_draft_content');
      localStorage.removeItem('zen_note_draft_tags');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onAddNote(text, []);
      }
    } catch (err) {
      alert("请允许剪贴板访问权限。");
    }
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (!selectedTag) return notes;
    return notes.filter(note => note.tags.includes(selectedTag));
  }, [notes, selectedTag]);

  const handleDeepAnalyze = async (noteId: string, text: string) => {
    setLoadingIds(prev => new Set(prev).add(noteId));
    try {
      const result = await deepAnalysis([{ text }]);
      if (result) setDeepInsights(prev => ({ ...prev, [noteId]: result }));
    } catch (error) { console.error(error); } finally {
      setLoadingIds(prev => { const next = new Set(prev); next.delete(noteId); return next; });
    }
  };

  const handleQuickSummary = async (noteId: string, content: string) => {
    setSummarizingId(noteId);
    try {
      const result = await quickQuery(`Summarize this briefly: "${content}"`);
      if (result) setSummaries(prev => ({ ...prev, [noteId]: result }));
    } catch (error) { console.error(error); } finally { setSummarizingId(null); }
  };

  const handleTranslate = async (noteId: string, content: string) => {
    setTranslatingId(noteId);
    try {
      const result = await translateText(content);
      if (result) setTranslations(prev => ({ ...prev, [noteId]: result }));
    } catch (error) { console.error("Translation failed", error); } finally { setTranslatingId(null); }
  };

  const handleSpeak = (text: string) => speakText(text);

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
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Clippings Vault</h2>
          <p className="text-slate-400 text-sm">智能收集并解析你的学习片段。</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-800/40 rounded-xl p-1 border border-white/5">
            <button onClick={canUndo ? onUndo : undoDraft} disabled={!canUndo && draftHistory.length === 0} className="p-2 rounded-lg text-slate-300 disabled:opacity-20 hover:bg-slate-700 transition-all"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg></button>
            <button onClick={canRedo ? onRedo : redoDraft} disabled={!canRedo && draftFuture.length === 0} className="p-2 rounded-lg text-slate-300 disabled:opacity-20 hover:bg-slate-700 transition-all"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg></button>
          </div>
          <button onClick={handlePasteFromClipboard} className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
            一键存入剪贴板
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-slate-800/20 border border-white/5 p-4 rounded-2xl space-y-3 shadow-inner">
        <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="输入内容..." className="w-full h-24 bg-slate-900/40 border border-white/10 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all resize-none text-sm"/>
        <div className="flex gap-3">
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Tags..." className="flex-1 px-4 py-2 bg-slate-900/40 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none"/>
          <button type="submit" disabled={!inputValue.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50">Save</button>
        </div>
      </form>

      <div className="space-y-4 pb-10">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl text-slate-500 text-sm italic">Nothing found.</div>
        ) : (
          filteredNotes.map(note => (
            <div key={note.id} className="group bg-slate-800/30 border border-white/5 p-5 rounded-2xl hover:bg-slate-800/50 transition-all cursor-pointer">
              <div className="flex justify-between">
                <div className="flex-1 overflow-hidden">
                  <p className={`text-slate-300 text-sm leading-relaxed ${note.style?.bold ? 'font-bold' : ''} ${note.style?.italic ? 'italic' : ''}`}>{note.content}</p>
                  
                  {translations[note.id] && (
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in slide-in-from-bottom-2 duration-300">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">AI Translation</span>
                        <button onClick={(e) => { e.stopPropagation(); handleSpeak(translations[note.id]); }} className="text-[9px] text-emerald-400 hover:text-white font-bold">SPEAK</button>
                      </div>
                      <p className="text-slate-300 text-xs italic">{translations[note.id]}</p>
                    </div>
                  )}

                  {summaries[note.id] && (
                    <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-slate-400 italic">
                      <span className="font-bold text-indigo-400 uppercase text-[9px] mr-2">Summary:</span>{summaries[note.id]}
                    </div>
                  )}
                  
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {note.tags.map(t => <span key={t} className="text-[9px] font-bold bg-white/5 text-slate-500 px-2 py-0.5 rounded">#{t}</span>)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col space-y-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleTranslate(note.id, note.content); }} disabled={translatingId === note.id} className={`p-2 rounded-lg ${translatingId === note.id ? 'animate-spin' : 'hover:bg-emerald-500/20 text-emerald-400'}`} title="AI Translate">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5c1.382 3.307 3.233 6.355 5.49 9.043"/></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleCopy(note.id, note.content); }} className="p-2 hover:bg-slate-700 text-slate-400 rounded-lg"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></button>
                  <button onClick={(e) => { e.stopPropagation(); handleQuickSummary(note.id, note.content); }} className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></button>
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
