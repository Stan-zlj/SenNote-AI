
import React, { useState } from 'react';
import { Note } from '../types';

interface NoteViewProps {
  notes: Note[];
  topics: string[];
  setTopics: React.Dispatch<React.SetStateAction<string[]>>;
  onAddNote: (content: string, tags: string[], topic: string) => void;
  onDeleteNote: (id: string, topic: string) => void;
  onDeleteTopic: (topic: string) => void;
}

const NoteView: React.FC<NoteViewProps> = ({ notes, topics, setTopics, onAddNote, onDeleteNote, onDeleteTopic }) => {
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredNotes = activeTopic ? notes.filter(n => n.topic === activeTopic) : [];

  const handleCreateTopic = () => {
    if (newTopicName.trim() && !topics.includes(newTopicName)) {
      setTopics(prev => [...prev, newTopicName]);
      setNewTopicName('');
    }
  };

  const handleAddNoteToTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && activeTopic) {
      onAddNote(inputValue, tagInput ? tagInput.split(/[，, ]/).filter(t => t) : [], activeTopic);
      setInputValue('');
      setTagInput('');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {!activeTopic ? (
        <div className="flex-1 flex flex-col space-y-6 animate-in fade-in duration-500">
          <header className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-white">并行便签空间</h2>
              <p className="text-slate-500 text-xs">不同主题，并行记录</p>
            </div>
          </header>

          <div className="flex gap-2">
            <input 
              value={newTopicName}
              onChange={e => setNewTopicName(e.target.value)}
              placeholder="开一个新主题..."
              className="flex-1 bg-slate-800/60 border border-white/5 rounded-2xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button onClick={handleCreateTopic} className="bg-indigo-600 hover:bg-indigo-500 px-4 rounded-2xl text-[10px] font-black uppercase">创建</button>
          </div>

          <div className="grid grid-cols-2 gap-4 overflow-y-auto custom-scrollbar pr-1">
            {topics.map(topic => (
              <div 
                key={topic} 
                onClick={() => setActiveTopic(topic)}
                className="group relative bg-slate-800/40 border border-white/5 p-5 rounded-[24px] cursor-pointer hover:bg-indigo-600/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between h-36"
              >
                <div>
                  <h3 className="font-bold text-slate-200 text-sm truncate">{topic}</h3>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">
                    {notes.filter(n => n.topic === topic).length} NOTES
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-[9px] text-indigo-400 font-bold">进入并行流 →</div>
                  {topic !== '未分类' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteTopic(topic); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-red-500 rounded-lg transition-opacity"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-6 animate-in slide-in-from-right duration-300">
          <header className="flex items-center gap-4">
            <button onClick={() => setActiveTopic(null)} className="p-2 bg-slate-800 rounded-xl hover:bg-indigo-600/20 text-lg">🔙</button>
            <div>
              <h2 className="text-xl font-black text-white">{activeTopic}</h2>
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">当前主题并行流</p>
            </div>
          </header>

          <form onSubmit={handleAddNoteToTopic} className="bg-slate-800/30 border border-white/5 p-4 rounded-3xl space-y-3 shrink-0">
            <textarea 
              value={inputValue} 
              onChange={(e) => setInputValue(e.target.value)} 
              placeholder="在此主题下记录..." 
              className="w-full h-24 bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-slate-200 focus:ring-1 focus:ring-indigo-500 transition-all resize-none text-sm"
            />
            <div className="flex gap-2">
              <input 
                value={tagInput} 
                onChange={(e) => setTagInput(e.target.value)} 
                placeholder="标签 (空格分隔)..." 
                className="flex-1 px-4 py-2 bg-slate-900/60 border border-white/10 rounded-xl text-xs text-slate-400 outline-none"
              />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl text-xs font-bold transition-all active:scale-95">保存便签</button>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-10">
            {filteredNotes.length === 0 ? (
              <div className="text-center py-20 text-slate-600 italic text-sm">此空间暂时为空。</div>
            ) : (
              filteredNotes.map(note => (
                <div key={note.id} className="group bg-slate-800/30 border border-white/5 p-5 rounded-3xl relative hover:border-white/10 transition-all">
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  <div className="mt-4 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-[9px] text-slate-500 font-mono">{new Date(note.createdAt).toLocaleString()}</span>
                      {note.tags.map(t => (
                        <span key={t} className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/10">#{t}</span>
                      ))}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => copyToClipboard(note.content, note.id)}
                        className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase ${copiedId === note.id ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                      >
                        {copiedId === note.id ? '已拷贝' : '拷贝'}
                      </button>
                      <button 
                        onClick={() => onDeleteNote(note.id, activeTopic)} 
                        className="px-2 py-1 bg-red-500/10 text-red-500 rounded-md text-[9px] font-bold uppercase hover:bg-red-500/20"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteView;
