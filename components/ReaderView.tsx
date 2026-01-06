
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Book, PDFAnnotation } from '../types';
import { deepAnalysis, speakText } from '../services/geminiService';

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
  
  // PDF Loading & Interactive states
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [isPanMode, setIsPanMode] = useState(false);
  const [showPdfSidebar, setShowPdfSidebar] = useState(true);
  const [showAiChat, setShowAiChat] = useState(true);

  // Annotation states
  const [activeTool, setActiveTool] = useState<AnnotationTool>('none');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{x: number, y: number}>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Navigation & Container refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isReading]);

  // Persistence Logic for Annotations
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

  // Canvas drawing logic
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

    if (currentPath.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
  }, [activeBook, pdfPage, currentPath]);

  useEffect(() => {
    if (activeBook?.type === 'pdf') {
      setIsPdfLoading(true);
      setPageInput(pdfPage.toString());
    }
  }, [pdfPage, activeBook?.id]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'none') { handleMouseDown(e); return; }
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

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (activeTool === 'none') { handleMouseMovePan(e); return; }
    if (!isDrawing || activeTool !== 'pen') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    setCurrentPath(prev => [...prev, { x, y }]);
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing && currentPath.length > 1) {
      saveAnnotations({ points: currentPath, color: '#6366f1', width: 2 }, null);
    }
    setIsDrawing(false);
    setCurrentPath([]);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.min(Math.max(0.1, prev + delta), 5));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isPanMode && zoomLevel <= 1) return;
    setIsDragging(true);
    const container = scrollContainerRef.current;
    if (!container) return;
    setStartX(e.pageX - container.offsetLeft);
    setStartY(e.pageY - container.offsetTop);
    setScrollLeft(container.scrollLeft);
    setScrollTop(container.scrollTop);
  };

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    container.scrollLeft = scrollLeft - (x - startX) * 1.2;
    container.scrollTop = scrollTop - (y - startY) * 1.2;
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
      
      // Add context history
      chatHistory.slice(-5).forEach(m => parts.push({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}` }));
      
      let contextStr = `Question about current ${activeBook.type}: ${userMsg}.`;
      if (activeBook.type === 'pdf') contextStr += ` (Focusing on Page ${pdfPage})`;
      if (activeBook.type === 'video') contextStr += ` (Timestamp: ${currentTime.toFixed(1)}s)`;
      
      parts.push({ text: contextStr });

      const result = await deepAnalysis(parts);
      if (result) setChatHistory(prev => [...prev, { role: 'model', content: result }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'model', content: "Error analyzing content. Please check API settings." }]);
    } finally {
      setIsReading(false);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetState = () => {
    setActiveBook(null);
    setChatHistory([]);
    setZoomLevel(1);
    setIsPanMode(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      {isUploading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">Rendering...</div>}

      {!activeBook ? (
        <>
          <header className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Workspace Library</h2>
            <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all">
              Add Media + <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          </header>
          <div className="grid gap-3 flex-1 overflow-y-auto custom-scrollbar">
            {books.length === 0 ? <p className="text-slate-500 text-center py-10 italic">Empty library.</p> : books.map(b => (
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
            <button onClick={resetState} className="text-slate-500 hover:text-white text-xs font-bold flex items-center gap-1"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 19l-7-7 7-7" /></svg> Back</button>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAiChat(!showAiChat)} className={`p-1.5 rounded-lg text-[10px] font-bold transition-all ${showAiChat ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'bg-slate-800 text-slate-500'}`}>AI CO-PILOT</button>
              <button onClick={() => setIsTheaterMode(!isTheaterMode)} className="text-[10px] bg-slate-800 px-3 py-1.5 rounded-lg text-slate-500 hover:text-white uppercase font-bold">Theater</button>
            </div>
          </div>

          <div className="flex-1 flex min-h-0 bg-slate-950/50 rounded-2xl border border-white/10 overflow-hidden relative shadow-inner">
            <div className="flex-1 flex flex-col min-h-0 relative">
              {/* Media controls toolbar */}
              <div className="p-2 border-b border-white/5 bg-slate-900/40 flex justify-between items-center">
                 <span className="text-[10px] font-bold text-slate-500 truncate max-w-[200px] uppercase ml-2">{activeBook.title}</span>
                 <div className="flex items-center gap-2">
                   {activeBook.type === 'pdf' && (
                     <div className="flex gap-1">
                       <button onClick={() => setActiveTool('pen')} className={`p-1.5 rounded ${activeTool === 'pen' ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                       <button onClick={() => setActiveTool('text')} className={`p-1.5 rounded ${activeTool === 'text' ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg></button>
                     </div>
                   )}
                   <button onClick={() => setZoomLevel(z => Math.max(0.2, z - 0.1))} className="p-1 hover:text-white text-slate-500"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 12H4" /></svg></button>
                   <span className="text-[10px] font-mono text-slate-500 w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
                   <button onClick={() => setZoomLevel(z => Math.min(5, z + 0.1))} className="p-1 hover:text-white text-slate-500"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg></button>
                   <button onClick={() => setIsPanMode(!isPanMode)} className={`p-1.5 rounded ${isPanMode ? 'bg-emerald-600' : 'hover:bg-slate-800'}`}><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0V12m-3 .5V12m3 .5V9a1.5 1.5 0 113 0v4.5m-3-4.5V9m3 .5V8a1.5 1.5 0 113 0v9a5 5 0 01-5 5h-3a5 5 0 01-5-5v-4.5a1.5 1.5 0 113 0V11" /></svg></button>
                 </div>
              </div>

              <div ref={scrollContainerRef} onWheel={handleWheel} onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} className={`flex-1 overflow-auto relative flex justify-center custom-scrollbar bg-black/20 ${isPanMode ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }} className="relative h-fit shadow-2xl transition-transform duration-200 mt-8 mb-32">
                  {activeBook.type === 'image' && <img src={activeBook.mediaUrl} className="max-w-none rounded-sm" />}
                  {activeBook.type === 'video' && <video src={activeBook.mediaUrl} controls className="max-w-none max-h-[80vh] rounded-xl shadow-2xl" onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} />}
                  {activeBook.type === 'pdf' && (
                    <div className="relative" style={{ width: '800px', height: '1100px' }}>
                      <iframe src={`${activeBook.mediaUrl}#page=${pdfPage}&toolbar=0&navpanes=0`} className="w-full h-full pointer-events-none border-none bg-white rounded-lg" onLoad={() => setIsPdfLoading(false)} />
                      <canvas ref={canvasRef} width={800} height={1100} className={`absolute inset-0 z-10 pointer-events-none ${activeTool !== 'none' ? 'pointer-events-auto' : ''}`} />
                      {activeBook.annotations?.[pdfPage]?.notes.map(n => (
                        <div key={n.id} style={{ left: n.x, top: n.y }} className="absolute z-20 bg-yellow-400 text-black p-2 rounded shadow-lg text-[10px] max-w-[120px] font-medium leading-tight">{n.text}</div>
                      ))}
                    </div>
                  )}
                </div>

                {activeBook.type === 'pdf' && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-4 z-40 shadow-2xl">
                    <button onClick={() => setPdfPage(p => Math.max(1, p - 1))} className="p-2 hover:bg-slate-700 rounded-xl transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 19l-7-7 7-7" /></svg></button>
                    <div className="flex items-center gap-2"><span className="text-[9px] font-black text-slate-500 uppercase">Page</span><span className="font-mono text-white text-sm font-bold">{pdfPage}</span></div>
                    <button onClick={() => setPdfPage(p => p + 1)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5l7 7-7 7" /></svg></button>
                  </div>
                )}
              </div>
            </div>

            {showAiChat && (
              <div className="w-80 bg-slate-900/95 border-l border-white/5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                <header className="p-4 border-b border-white/5 bg-slate-800/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_purple]"></div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Co-Pilot Reasoning</h3>
                  </div>
                  <button onClick={() => setChatHistory([])} className="text-[10px] text-slate-500 hover:text-white uppercase font-bold">Clear</button>
                </header>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {chatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 space-y-4">
                      <p className="text-[9px] font-bold uppercase text-center leading-relaxed">Multimodal Analysis Ready.<br/>Ask about current content.</p>
                      <button onClick={() => handleAnalyzeMedia("Briefly summarize this page.")} className="text-[9px] border border-white/10 px-4 py-2 rounded-lg hover:bg-white/5 font-bold uppercase">Quick Summary</button>
                    </div>
                  )}
                  {chatHistory.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10' : 'bg-slate-800/80 text-slate-200 border border-white/10'}`}>
                        {m.content}
                        {m.role === 'model' && (
                          <button onClick={() => speakText(m.content)} className="block mt-2 text-[9px] text-indigo-400 hover:text-white font-bold uppercase transition-colors">Listen</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {isReading && (
                    <div className="flex items-center gap-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-2xl animate-pulse">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                      <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Thinking Deeply...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-slate-950/40 border-t border-white/5">
                  <div className="relative group">
                    <input value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeMedia()} placeholder="Ask co-pilot..." className="w-full bg-slate-900 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-xs text-slate-200 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all" />
                    <button onClick={() => handleAnalyzeMedia()} disabled={isReading || !aiQuestion.trim()} className="absolute right-2 top-1.5 w-8 h-8 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-50"><svg className="h-4 w-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
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
