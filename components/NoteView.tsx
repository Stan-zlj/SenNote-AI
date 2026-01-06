
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Note } from '../types';
import { deepAnalysis, speakText, quickQuery } from '../services/geminiService';

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
  // Local state for draft history
  const [inputValue, setInputValue] = useState(() => {
    return localStorage.getItem('zen_note_draft_content') || '';
  });
  const [tagInput, setTagInput] = useState(() => {
    return localStorage.getItem('zen_note_draft_tags') || '';
  });

  const [draftHistory, setDraftHistory] = useState<{content: string, tags: string}[]>([]);
  const [draftFuture, setDraftFuture] = useState<{content: string, tags: string}[]>([]);
  const lastSavedDraft = useRef({ content: inputValue, tags: tagInput });
  
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [deepInsights, setDeepInsights] = useState<Record<string, string>>({});
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tag Management States
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [tagSearchModalQuery, setTagSearchModalQuery] = useState('');

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && isZ) {
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        e.preventDefault();
      } else if (isMod && isY) {
        onRedo();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo]);

  // Auto-save and History tracker for draft
  useEffect(() => {
    localStorage.setItem('zen_note_draft_content', inputValue);
    localStorage.setItem('zen_note_draft_tags', tagInput);

    // Snapshot mechanism for local history
    const timeout = setTimeout(() => {
      if (inputValue !== lastSavedDraft.current.content || tagInput !== lastSavedDraft.current.tags) {
        setDraftHistory(prev => [...prev.slice(-19), { ...lastSavedDraft.current }]);
        setDraftFuture([]);
        lastSavedDraft.current = { content: inputValue, tags: tagInput };
      }
    }, 1000); // Save snapshot after 1s of inactivity

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
        const btn = document.getElementById('paste-btn');
        if (btn) btn.classList.add('bg-green-600');
        setTimeout(() => btn?.classList.remove('bg-green-600'), 1000);
      }
    } catch (err) {
      alert("请先在浏览器弹窗中允许剪贴板访问权限。");
    }
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [notes]);

  const filteredModalTags = useMemo(() => {
    if (!tagSearchModalQuery.trim()) return allTags;
    return allTags.filter(tag => tag.toLowerCase().includes(tagSearchModalQuery.toLowerCase()));
  }, [allTags, tagSearchModalQuery]);

  const filteredNotes = useMemo(() => {
    if (!selectedTag) return notes;
    return notes.filter(note => note.tags.includes(selectedTag));
  }, [notes, selectedTag]);

  // Tag Management Functions
  const handleRenameTag = (oldTag: string, newTag: string) => {
    if (!newTag.trim() || oldTag === newTag) return;
    setNotes(prev => prev.map(note => ({
      ...note,
      tags: note.tags.map(t => t === oldTag ? newTag.trim() : t)
    })));
    if (selectedTag === oldTag) setSelectedTag(newTag.trim());
    setEditingTag(null);
    setNewTagName('');
  };

  const handleDeleteTag = (tagToDelete: string) => {
    setNotes(prev => prev.map(note => ({
      ...note,
      tags: note.tags.filter(t => t !== tagToDelete)
    })));
    if (selectedTag === tagToDelete) setSelectedTag(null);
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
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Clippings Vault</h2>
          <p className="text-slate-400 text-sm">智能收集并解析你的学习片段。</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* History Controls */}
          <div className="flex bg-slate-800/40 rounded-xl p-1 border border-white/5">
            <button 
              onClick={canUndo ? onUndo : undoDraft} 
              disabled={!canUndo && draftHistory.length === 0}
              className={`p-2 rounded-lg transition-all ${(!canUndo && draftHistory.length === 0) ? 'text-slate-600 opacity-30' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
              title="Undo (Notes or Draft)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button 
              onClick={canRedo ? onRedo : redoDraft} 
              disabled={!canRedo && draftFuture.length === 0}
              className={`p-2 rounded-lg transition-all ${(!canRedo && draftFuture.length === 0) ? 'text-slate-600 opacity-30' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
              title="Redo (Notes or Draft)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </div>

          <button 
            id="paste-btn"
            onClick={handlePasteFromClipboard}
            className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-400 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            一键存入剪贴板
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-slate-800/20 border border-white/5 p-4 rounded-2xl space-y-3 shadow-inner">
        <div className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="在这里手动输入或粘贴内容..."
            className="w-full h-24 bg-slate-900/40 border border-white/10 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all resize-none text-sm"
          />
          {(inputValue || tagInput) && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-slate-900/60 rounded-lg border border-white/5 pointer-events-none opacity-60">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Draft Saved</span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 group">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400">
               <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
               </svg>
             </div>
             <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Tags (comma separated)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900/40 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-lg disabled:opacity-50"
          >
            Save Note
          </button>
        </div>
      </form>

      {/* Tag Filtering UI */}
      <div className="flex flex-wrap items-center gap-2 py-2 border-b border-white/5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filter:
        </span>
        <button
          onClick={() => setSelectedTag(null)}
          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${!selectedTag ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          All Notes
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${selectedTag === tag ? 'bg-indigo-500 text-white shadow-indigo-500/20 shadow-lg' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'}`}
          >
            #{tag}
          </button>
        ))}

        {/* Manage Tags Button */}
        {allTags.length > 0 && (
          <button
            onClick={() => setIsManagingTags(true)}
            className="ml-auto text-[10px] text-slate-500 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            title="Manage all tags"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Tags
          </button>
        )}
      </div>

      <div className="space-y-4 pb-10">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl">
            <p className="text-slate-500 text-sm">
              {selectedTag ? `No notes tagged with #${selectedTag}` : '还没有存入任何内容。'}
            </p>
            {selectedTag && (
              <button onClick={() => setSelectedTag(null)} className="mt-4 text-xs text-indigo-400 hover:underline">Clear filter</button>
            )}
          </div>
        ) : (
          filteredNotes.map(note => (
            <div 
              key={note.id} 
              className="group bg-slate-800/30 border border-white/5 p-5 rounded-2xl hover:bg-slate-800/50 transition-all shadow-sm cursor-pointer hover:scale-[1.01] hover:shadow-xl hover:shadow-indigo-500/10 hover:border-white/10"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 overflow-hidden">
                  <p className={`text-slate-300 text-sm leading-relaxed whitespace-pre-wrap ${note.style?.bold ? 'font-bold' : ''} ${note.style?.italic ? 'italic' : ''} ${note.style?.underline ? 'underline' : ''}`}>
                    {note.content}
                  </p>
                  
                  {/* Tag Display */}
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {note.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 no-underline not-italic">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
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
                        <button onClick={(e) => { e.stopPropagation(); handleSpeak(deepInsights[note.id]); }} className="text-[10px] text-indigo-400 hover:text-white font-bold flex items-center gap-1 transition-colors">
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
                  {/* Text Styling Group */}
                  <div className="flex flex-col gap-1 border-b border-white/5 pb-2 mb-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onToggleStyle?.(note.id, 'bold'); }} 
                      className={`p-1.5 rounded transition-all text-[10px] font-black ${note.style?.bold ? 'bg-indigo-500 text-white' : 'hover:bg-slate-700 text-slate-500'}`}
                      title="Bold Toggle"
                    >
                      B
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onToggleStyle?.(note.id, 'italic'); }} 
                      className={`p-1.5 rounded transition-all text-[10px] italic font-serif ${note.style?.italic ? 'bg-indigo-500 text-white' : 'hover:bg-slate-700 text-slate-500'}`}
                      title="Italic Toggle"
                    >
                      I
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onToggleStyle?.(note.id, 'underline'); }} 
                      className={`p-1.5 rounded transition-all text-[10px] underline ${note.style?.underline ? 'bg-indigo-500 text-white' : 'hover:bg-slate-700 text-slate-500'}`}
                      title="Underline Toggle"
                    >
                      U
                    </button>
                  </div>

                  <button onClick={(e) => { e.stopPropagation(); handleCopy(note.id, note.content); }} className={`p-2 rounded-lg transition-all ${copiedId === note.id ? 'bg-green-500/20 text-green-400 scale-110' : 'hover:bg-slate-700 text-slate-400'}`} title="Copy to Clipboard">
                    {copiedId === note.id ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    )}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleSpeak(note.content); }} className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-all" title="Read Aloud">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleQuickSummary(note.id, note.content); }} 
                    disabled={summarizingId === note.id}
                    className={`p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-all ${summarizingId === note.id ? 'animate-pulse scale-90' : ''}`} 
                    title="Quick AI Summary"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeepAnalyze(note.id, note.content); }} 
                    disabled={loadingIds.has(note.id)} 
                    className={`p-2 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-all ${loadingIds.has(note.id) ? 'animate-pulse scale-90' : ''}`} 
                    title="Deep AI Insight (Thinking Mode)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setNoteToDelete(note.id); }} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-all" title="Archive Clipping">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tag Management Modal */}
      {isManagingTags && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Tag Management</h3>
              <button 
                onClick={() => { setIsManagingTags(false); setTagSearchModalQuery(''); }} 
                className="text-slate-500 hover:text-white transition-colors p-1"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {/* Tag Search Input inside Modal */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={tagSearchModalQuery}
                onChange={(e) => setTagSearchModalQuery(e.target.value)}
                placeholder="Search tags..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-white/10 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
              {filteredModalTags.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <p className="text-slate-500 text-sm">
                    {tagSearchModalQuery ? `No tags matching "${tagSearchModalQuery}"` : 'No tags found.'}
                  </p>
                </div>
              ) : (
                filteredModalTags.map(tag => (
                  <div key={tag} className="flex items-center gap-2 p-3 bg-slate-800/40 border border-white/5 rounded-2xl group transition-all hover:border-indigo-500/30">
                    {editingTag === tag ? (
                      <div className="flex-1 flex gap-2">
                        <input 
                          autoFocus
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameTag(tag, newTagName)}
                          className="bg-slate-900 border border-indigo-500/50 rounded-lg px-2 py-1 text-xs text-white flex-1 focus:outline-none"
                        />
                        <button onClick={() => handleRenameTag(tag, newTagName)} className="text-emerald-400 hover:text-emerald-300">
                           <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button onClick={() => setEditingTag(null)} className="text-slate-500 hover:text-slate-300">
                           <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-300 font-medium">#{tag}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditingTag(tag); setNewTagName(tag); }} 
                            className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                            title="Rename"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteTag(tag)} 
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Remove from all notes"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <button 
              onClick={() => { setIsManagingTags(false); setTagSearchModalQuery(''); }} 
              className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-sm font-bold transition-all border border-white/5 shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
