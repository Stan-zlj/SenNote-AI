
import React, { useState, useEffect } from 'react';
import { ViewMode, Note } from './types';
import Sidebar from './components/Sidebar';
import NoteView from './components/NoteView';
import StudioView from './components/StudioView';
import MindMapView from './components/MindMapView';
import DashboardView from './components/DashboardView';
import ChatBotView from './components/ChatBotView';
import LiveChatView from './components/LiveChatView';

const getIpc = () => {
  if (typeof window !== 'undefined' && (window as any).require) {
    try { return (window as any).require('electron').ipcRenderer; } catch (e) { return null; }
  }
  return null;
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const ipc = getIpc();
  
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [notes, setNotesState] = useState<Note[]>([]);
  const [topics, setTopics] = useState<string[]>(['未分类']);

  useEffect(() => {
    const loadData = async () => {
      if (ipc) {
        const data = await ipc.invoke('get-all-data');
        setTopics(data.topics.length ? data.topics : ['未分类']);
        setNotesState(data.notes || []);
      }
    };
    loadData();
  }, [ipc]);

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
            topic: '未分类'
          };
          ipc.send('save-note', { note: newNote, topic: '未分类' });
          return [newNote, ...prev];
        });
      };
      ipc.on('clipboard-sync', handleClipboard);
      return () => { ipc.removeAllListeners('clipboard-sync'); };
    }
  }, [ipc]);

  const handleAddNote = (content: string, tags: string[], topic: string) => {
    const newNote: Note = { id: Date.now().toString(), content, createdAt: Date.now(), tags, topic };
    setNotesState(prev => [newNote, ...prev]);
    if (ipc) ipc.send('save-note', { note: newNote, topic });
  };

  const handleDeleteNote = (id: string, topic: string) => {
    setNotesState(prev => prev.filter(n => n.id !== id));
    if (ipc) ipc.send('delete-note', { noteId: id, topic });
  };

  const handleDeleteTopic = (topic: string) => {
    setTopics(prev => prev.filter(t => t !== topic));
    setNotesState(prev => prev.filter(n => n.topic !== topic));
    if (ipc) ipc.send('delete-topic', topic);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden relative border border-white/10 rounded-2xl shadow-2xl">
      <div style={{ WebkitAppRegion: 'drag' } as any} className="absolute top-0 left-0 right-0 h-12 z-0 cursor-move" />
      <div className="absolute top-0 left-0 right-0 h-12 flex justify-between items-center px-4 z-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">ZenNote AI</span>
        </div>
        <div className="flex space-x-3 items-center pointer-events-auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
           <button onClick={() => ipc?.send('window-min')} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:brightness-110 active:scale-90 transition-all" />
           <button onClick={() => ipc?.send('window-close')} className="w-3 h-3 rounded-full bg-red-500/80 hover:brightness-110 active:scale-90 transition-all" />
        </div>
      </div>
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="flex-1 flex flex-col pt-14 pb-4 px-6 overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950/20">
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {activeView === ViewMode.DASHBOARD && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <DashboardView timerSeconds={timerSeconds} setTimerSeconds={setTimerSeconds} isRunning={isTimerRunning} setIsRunning={setIsTimerRunning} />
            </div>
          )}
          {activeView === ViewMode.NOTES && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <NoteView 
                notes={notes} 
                topics={topics}
                setTopics={setTopics}
                onAddNote={handleAddNote} 
                onDeleteNote={handleDeleteNote}
                onDeleteTopic={handleDeleteTopic}
              />
            </div>
          )}
          {activeView === ViewMode.CHAT && <ChatBotView />}
          {activeView === ViewMode.LIVE && <LiveChatView />}
          {activeView === ViewMode.STUDIO && <StudioView />}
          {activeView === ViewMode.MINDMAP && <MindMapView />}
        </div>
      </main>
    </div>
  );
};

export default App;
