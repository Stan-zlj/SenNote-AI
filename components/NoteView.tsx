
import React, { useState } from 'react';
import { Note } from '../types';

interface NoteViewProps {
  notes: Note[];
  onAddNote: (content: string, tags: string[]) => void;
  setNotes: (notes: Note[] | ((prev: Note[]) => Note[])) => void;
  onDeleteNote: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const NoteView: React.FC<NoteViewProps> = ({ 
  notes, 
  onAddNote, 
  setNotes, 
  onDeleteNote,
  onUndo, 
  onRedo, 
  canUndo, 
  canRedo 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      onAddNote(inputValue, tagInput ? tagInput.split(/[，, ]/).filter(t => t) : []);
      setInputValue('');
      setTagInput('');
    }
  };

  const saveEdit = (id: string) => {
    // 这里如果只是简单 setNotes，App.tsx 里的逻辑需要捕捉并保存到 TXT
    // 为了简单起见，我们在 App.tsx 统一处理。
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content: editingContent } : n));
    
    // 如果有 IPC 暴露，这里也可以手动触发一次保存
    const ipc = (window as any).require?.('electron')?.ipcRenderer;
    if (ipc) {
        const note = notes.find(n => n.id === id);
        if (note) ipc.send('save-note', { ...note, content: editingContent });
    }

    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-white">我的笔记</h2>
          <p className="text-slate-500 text-xs">笔记已实时保存为本地 TXT 文件，随时可查。</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onUndo} disabled={!canUndo} className="p-2 bg-slate-800 rounded-lg disabled:opacity-20 hover:bg-indigo-600/20">↩️</button>
          <button onClick={onRedo} disabled={!canRedo} className="p-2 bg-slate-800 rounded-lg disabled:opacity-20 hover:bg-indigo-600/20">↪️</button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-slate-800/30 border border-white/5 p-4 rounded-2xl space-y-3">
        <textarea 
          value={inputValue} 
          onChange={(e) => setInputValue(e.target.value)} 
          placeholder="写点什么... (剪贴板内容会自动同步至此)" 
          className="w-full h-20 bg-slate-900/60 border border-white/10 rounded-xl p-3 text-slate-200 focus:ring-1 focus:ring-indigo-500 transition-all resize-none text-sm"
        />
        <div className="flex gap-2">
          <input 
            value={tagInput} 
            onChange={(e) => setTagInput(e.target.value)} 
            placeholder="输入标签 (空格或逗号分隔)..." 
            className="flex-1 px-3 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-slate-400 outline-none"
          />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold">保存笔记</button>
        </div>
      </form>

      <div className="space-y-3 pb-20">
        {notes.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl text-slate-600">暂无笔记，记录从现在开始。</div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="group bg-slate-800/40 border border-white/5 p-4 rounded-2xl relative transition-all hover:border-white/10">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea 
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="w-full bg-slate-900 border border-indigo-500 rounded-xl p-3 text-sm h-24 text-slate-200"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(note.id)} className="px-3 py-1 bg-indigo-600 text-white text-[10px] rounded-lg font-bold">保存修改</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-slate-700 text-slate-300 text-[10px] rounded-lg">取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-[8px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md font-mono">
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                      {note.tags.map(t => (
                        <span key={t} className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/10">#{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <button 
                      onClick={() => { setEditingId(note.id); setEditingContent(note.content); }} 
                      className="p-1.5 hover:bg-white/5 text-slate-400 rounded-lg"
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => onDeleteNote(note.id)} 
                      className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-lg"
                      title="彻底删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NoteView;
