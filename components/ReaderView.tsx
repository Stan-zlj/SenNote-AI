
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Book, PDFAnnotation } from '../types';
import { deepAnalysis, speakText, translateText } from '../services/geminiService';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface ReaderViewProps {
  books: Book[];
  setBooks: (books: Book[]) => void;
}

type AnnotationTool = 'none' | 'pen' | 'eraser' | 'text';

const ReaderView: React.FC<ReaderViewProps> = ({ books, setBooks }) => {
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Auto-translate settings
  const [autoTranslate, setAutoTranslate] = useState(() => localStorage.getItem('zen_auto_translate') === 'true');
  const [targetLanguage, setTargetLanguage] = useState(() => localStorage.getItem('zen_target_lang') || 'Chinese');
  const [showSettings, setShowSettings] = useState(false);

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pdfPage, setPdfPage] = useState(1);
  const [isPanMode, setIsPanMode] = useState(false);
  const [showAiChat, setShowAiChat] = useState(true);

  // Drag & Pan state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const [activeTool, setActiveTool] = useState<AnnotationTool>('none');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{x: number, y: number}>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Persistence for settings
  useEffect(() => {
    localStorage.setItem('zen_auto_translate', autoTranslate.toString());
    localStorage.setItem('zen_target_lang', targetLanguage);
  }, [autoTranslate, targetLanguage]);

  // Auto-translate on load
  useEffect(() => {
    if (activeBook && autoTranslate) {
      handleAnalyzeMedia(`Please provide a concise translation of this ${activeBook.type} content into ${targetLanguage}.`);
    }
  }, [activeBook?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isReading]);

  const saveAnnotations = useCallback((newDrawing?: any, newNote?: any) => {
    if (!activeBook) return;
    const updatedBooks = books.map(b => {
      if (b.id !== activeBook.id) return b;
      const annotations = { ...(b.annotations || {}) };
      const pageAnn: PDFAnnotation = annotations[pdfPage] || { page: pdfPage, drawings: [], notes: [] };
      if (newDrawing) pageAnn.drawings.push(newDrawing);
      if (newNote) pageAnn.notes.push(newNote);
      annotations[pdfPage] = pageAnn;
      return { ...b, annotations };
    });
    setBooks(updatedBooks);
  }, [activeBook, pdfPage, books, setBooks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeBook) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ann = activeBook.annotations?.[pdfPage];
    if (ann) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ann.drawings.forEach(draw => {
        if (draw.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = draw.color;
        ctx.lineWidth = draw.width;
        ctx.moveTo(draw.points[0].x, draw.points[0].y);
        draw.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      });
    }
  }, [activeBook, pdfPage, currentPath]);

  // Handling Pan & Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== 'none' || !scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setStartY(e.pageY - scrollContainerRef.current.offsetTop);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    setScrollTop(scrollContainerRef.current.scrollTop);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (activeTool === 'pen' && isDrawing) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / zoomLevel;
      const y = (e.clientY - rect.top) / zoomLevel;
      setCurrentPath(prev => [...prev, { x, y }]);
    } else if (isDragging && scrollContainerRef.current) {
      e.preventDefault();
      const x = e.pageX - scrollContainerRef.current.offsetLeft;
      const y = e.pageY - scrollContainerRef.current.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      scrollContainerRef.current.scrollLeft = scrollLeft - walkX;
      scrollContainerRef.current.scrollTop = scrollTop - walkY;
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentPath.length > 1) {
      saveAnnotations({ points: currentPath, color: '#6366f1', width: 2 }, null);
    }
    setIsDrawing(false);
    setIsDragging(false);
    setCurrentPath([]);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'none') {
      handleMouseDown(e);
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    if (activeTool === 'pen') { setIsDrawing(true); setCurrentPath([{ x, y }]); }
    else if (activeTool === 'text') {
      const text = prompt("Enter memo:");
      if (text) saveAnnotations(null, { id: Date.now().toString(), text, x, y });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const type = file.type.includes('video') ? 'video' : file.type.includes('image') ? 'image' : 'pdf';
      const url = URL.createObjectURL(file);
      setBooks([{ id: Date.now().toString(), title: file.name, contentSnippet: `Manual Upload`, progress: 0, type: type as any, mediaUrl: url }, ...books]);
      setIsUploading(false);
    }
  };

  const handleAnalyzeMedia = async (overridePrompt?: string) => {
    if (!activeBook || !activeBook.mediaUrl) return;
    const userMsg = overridePrompt || aiQuestion.trim();
    if (!userMsg) return;
    if (!overridePrompt) setAiQuestion('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsReading(true);
    try {
      const mimeType = activeBook.type === 'image' ? 'image/png' : activeBook.type === 'video' ? 'video/mp4' : 'application/pdf';
      const response = await fetch(activeBook.mediaUrl);
      const blob = await response.blob();
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const parts: any[] = [{ inlineData: { data: base64Data, mimeType } }];
      chatHistory.slice(-3).forEach(m => parts.push({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}` }));
      parts.push({ text: `Content analysis request (Page ${pdfPage}): ${userMsg}` });
      const result = await deepAnalysis(parts);
      if (result) setChatHistory(prev => [...prev, { role: 'model', content: result }]);
    } catch (error) { setChatHistory(prev => [...prev, { role: 'model', content: "Error analyzing content." }]); } finally { setIsReading(false); }
  };

  const resetState = () => { setActiveBook(null); setChatHistory([]); setZoomLevel(1); setIsPanMode(false); };

  const languages = ["Chinese", "English", "Japanese", "Spanish", "French", "German", "Korean", "Russian"];

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      {!activeBook ? (
        <>
          <header className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Media Library</h2>
            <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all">Add + <input type="file" className="hidden" onChange={handleFileUpload}/></label>
          </header>
          <div className="grid gap-3 flex-1 overflow-y-auto custom-scrollbar">
            {books.length === 0 ? <p className="text-slate-500 text-center py-10 italic text-sm">Library is empty. Upload a PDF or Image.</p> : books.map(b => (
              <div key={b.id} onClick={() => setActiveBook(b)} className="bg-slate-800/40 border border-white/5 p-4 rounded-2xl hover:bg-indigo-600/10 cursor-pointer flex items-center gap-4 group">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-xl shadow-inner">{b.type === 'video' ? '🎥' : b.type === 'image' ? '🖼️' : '📄'}</div>
                <div className="flex-1 truncate"><h4 className="font-bold text-sm text-slate-200 group-hover:text-white">{b.title}</h4></div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-500">
          <div className="flex justify-between items-center mb-3">
            <button onClick={resetState} className="text-slate-500 hover:text-white text-xs font-bold flex items-center gap-1">← Back</button>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAiChat(!showAiChat)} className={`p-1.5 rounded-lg text-[10px] font-bold ${showAiChat ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500'}`}>AI CO-PILOT</button>
            </div>
          </div>
          <div className="flex-1 flex min-h-0 bg-slate-950 rounded-2xl border border-white/10 overflow-hidden relative">
            <div className="flex-1 flex flex-col min-h-0 relative">
              <div className="p-2 border-b border-white/5 bg-slate-900/40 flex justify-between items-center">
                 <span className="text-[10px] font-bold text-slate-500 truncate max-w-[200px] uppercase ml-2">{activeBook.title}</span>
                 <div className="flex gap-2">
                   <button onClick={() => setZoomLevel(z => Math.max(0.2, z-0.1))} className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-xs hover:text-white text-slate-500">-</button>
                   <span className="text-[10px] text-slate-500 self-center">{Math.round(zoomLevel*100)}%</span>
                   <button onClick={() => setZoomLevel(z => Math.min(4, z+0.1))} className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-xs hover:text-white text-slate-500">+</button>
                   <button onClick={() => setIsPanMode(!isPanMode)} className={`p-1 rounded ${isPanMode ? 'bg-indigo-600' : 'bg-slate-800'} text-xs`} title="Toggle Pan Mode">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0V12m-3 .5V12m3 .5V9a1.5 1.5 0 113 0v4.5m-3-4.5V9m3 .5V8a1.5 1.5 0 113 0v9a5 5 0 01-5 5h-3a5 5 0 01-5-5v-4.5a1.5 1.5 0 113 0V11" /></svg>
                   </button>
                 </div>
              </div>
              <div 
                ref={scrollContainerRef} 
                onMouseDown={handleCanvasMouseDown} 
                onMouseMove={handleMouseMove} 
                onMouseUp={handleMouseUp} 
                onMouseLeave={handleMouseUp}
                className={`flex-1 overflow-auto relative flex justify-center bg-slate-900/50 custom-scrollbar ${isPanMode || activeTool === 'none' ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }} className="relative h-fit mt-8 mb-32 transition-transform duration-100 ease-out">
                  {activeBook.type === 'pdf' && (
                    <div className="relative" style={{ width: '800px', height: '1100px' }}>
                      <iframe src={`${activeBook.mediaUrl}#page=${pdfPage}&toolbar=0&navpanes=0`} className="w-full h-full pointer-events-none bg-white rounded-lg shadow-2xl"/>
                      <canvas ref={canvasRef} width={800} height={1100} className={`absolute inset-0 z-10 ${activeTool !== 'none' ? 'pointer-events-auto' : 'pointer-events-none'}`}/>
                    </div>
                  )}
                  {activeBook.type === 'image' && <img src={activeBook.mediaUrl} className="rounded-xl shadow-2xl max-w-[1200px] h-auto"/>}
                  {activeBook.type === 'video' && <video src={activeBook.mediaUrl} controls className="max-h-[80vh] rounded-xl shadow-2xl" onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}/>}
                </div>
                {activeBook.type === 'pdf' && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-4 z-40 shadow-2xl backdrop-blur-md">
                    <button onClick={() => setPdfPage(p => Math.max(1, p - 1))} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">Prev</button>
                    <span className="font-mono text-white text-xs font-bold uppercase tracking-widest">Page {pdfPage}</span>
                    <button onClick={() => setPdfPage(p => p + 1)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">Next</button>
                  </div>
                )}
              </div>
            </div>
            {showAiChat && (
              <div className="w-80 bg-slate-900 border-l border-white/5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                <header className="p-4 border-b border-white/5 bg-slate-800/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Co-Pilot</h3>
                    <button onClick={() => setShowSettings(!showSettings)} className={`p-1 rounded hover:bg-white/5 transition-colors ${showSettings ? 'text-indigo-400' : 'text-slate-500'}`}>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </button>
                  </div>
                  <button onClick={() => setChatHistory([])} className="text-[10px] text-slate-500 uppercase font-bold">Clear</button>
                </header>

                {showSettings && (
                  <div className="p-4 bg-slate-800/40 border-b border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Auto-Translate</span>
                      <button onClick={() => setAutoTranslate(!autoTranslate)} className={`w-8 h-4 rounded-full transition-colors relative ${autoTranslate ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${autoTranslate ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-slate-200">
                      {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {chatHistory.length === 0 && (
                    <div className="flex flex-col gap-2 opacity-30">
                       <button onClick={() => handleAnalyzeMedia("Briefly summarize this page.")} className="text-[9px] border border-white/10 px-4 py-2 rounded-lg hover:bg-white/5 font-bold uppercase">Quick Summary</button>
                       <button onClick={() => handleAnalyzeMedia(`Translate this current content to ${targetLanguage}.`)} className="text-[9px] border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg hover:bg-emerald-500/5 font-bold uppercase">Translate View</button>
                    </div>
                  )}
                  {chatHistory.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-200 border border-white/10 shadow-inner'}`}>
                        {m.content}
                        {m.role === 'model' && <button onClick={() => speakText(m.content)} className="block mt-2 text-[8px] text-indigo-400 font-bold hover:text-white transition-colors">LISTEN 🔊</button>}
                      </div>
                    </div>
                  ))}
                  {isReading && <div className="text-[9px] font-black text-purple-400 uppercase animate-pulse tracking-widest">Co-pilot Thinking...</div>}
                  <div ref={chatEndRef}/>
                </div>
                <div className="p-4 border-t border-white/5 bg-slate-950/20">
                  <div className="relative group">
                    <input value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeMedia()} placeholder="Ask co-pilot..." className="w-full bg-slate-900 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-purple-500/50 transition-all shadow-inner"/>
                    <button onClick={() => handleAnalyzeMedia()} disabled={isReading || !aiQuestion.trim()} className="absolute right-2 top-1.5 w-8 h-8 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-50">
                      <svg className="h-3.5 w-3.5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReaderView;
