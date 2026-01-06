
import React, { useState, useRef, useEffect } from 'react';
import { Book } from '../types';
import { deepAnalysis, speakText } from '../services/geminiService';

interface ChatMessage { role: 'user' | 'model'; content: string; }

const ReaderView: React.FC<{ books: Book[], setBooks: (books: Book[]) => void }> = ({ books, setBooks }) => {
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pdfPage, setPdfPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [showAiChat, setShowAiChat] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(() => localStorage.getItem('zen_auto_translate') === 'true');
  const [targetLanguage, setTargetLanguage] = useState(() => localStorage.getItem('zen_target_lang') || 'Chinese');
  const [showSettings, setShowSettings] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0, sLeft: 0, sTop: 0 });

  // 持久化阅读进度
  useEffect(() => {
    if (activeBook) {
      const savedPage = localStorage.getItem(`progress_${activeBook.id}`);
      if (savedPage) {
        const p = parseInt(savedPage);
        setPdfPage(p);
        setPageInput(p.toString());
      } else {
        setPdfPage(1);
        setPageInput('1');
      }
    }
  }, [activeBook?.id]);

  useEffect(() => {
    if (activeBook) {
      localStorage.setItem(`progress_${activeBook.id}`, pdfPage.toString());
    }
  }, [pdfPage, activeBook?.id]);

  useEffect(() => {
    localStorage.setItem('zen_auto_translate', autoTranslate.toString());
    localStorage.setItem('zen_target_lang', targetLanguage);
  }, [autoTranslate, targetLanguage]);

  const handleAnalyzeMedia = async (overridePrompt?: string) => {
    if (!activeBook || !activeBook.mediaUrl) return;
    const msg = overridePrompt || aiQuestion.trim();
    if (!msg) return;
    if (!overridePrompt) setAiQuestion('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setIsReading(true);
    try {
      const res = await fetch(activeBook.mediaUrl);
      const blob = await res.blob();
      const base64 = await new Promise<string>(r => {
        const reader = new FileReader();
        reader.onloadend = () => r((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const result = await deepAnalysis([
        { inlineData: { data: base64, mimeType: activeBook.type === 'pdf' ? 'application/pdf' : activeBook.type === 'image' ? 'image/png' : 'video/mp4' } },
        { text: `Current Page/Context: ${pdfPage}. Request: ${msg}` }
      ]);
      if (result) setChatHistory(prev => [...prev, { role: 'model', content: result }]);
    } catch (e) { setChatHistory(prev => [...prev, { role: 'model', content: "AI Co-pilot encountered an error. Please try again." }]); }
    finally { setIsReading(false); }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setDragPos({ x: e.pageX, y: e.pageY, sLeft: scrollContainerRef.current.scrollLeft, sTop: scrollContainerRef.current.scrollTop });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    const dx = e.pageX - dragPos.x;
    const dy = e.pageY - dragPos.y;
    scrollContainerRef.current.scrollLeft = dragPos.sLeft - dx;
    scrollContainerRef.current.scrollTop = dragPos.sTop - dy;
  };

  const handlePageJump = () => {
    const p = parseInt(pageInput);
    if (!isNaN(p) && p > 0) {
      setPdfPage(p);
    } else {
      setPageInput(pdfPage.toString());
    }
  };

  return (
    <div className="h-full flex flex-col">
      {!activeBook ? (
        <div className="grid gap-4 overflow-y-auto pb-10">
          <h2 className="text-xl font-bold bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">Media Library</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {books.map(b => (
              <div key={b.id} onClick={() => setActiveBook(b)} className="bg-slate-800/40 p-5 rounded-3xl border border-white/5 cursor-pointer hover:bg-indigo-600/10 hover:border-indigo-500/30 group transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    {b.type === 'pdf' ? '📄' : b.type === 'image' ? '🖼️' : '🎥'}
                  </div>
                  <div>
                    <span className="block font-bold text-slate-200">{b.title}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">{b.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl relative">
          <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="p-3 border-b border-white/5 flex justify-between items-center bg-slate-900/60 backdrop-blur-md z-30">
              <button onClick={() => setActiveBook(null)} className="text-[10px] font-bold text-slate-400 hover:text-white uppercase transition-colors flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                Library
              </button>
              <div className="flex gap-4 items-center">
                <div className="flex gap-1 items-center bg-slate-950/40 rounded-xl p-1 border border-white/5">
                  <button onClick={() => setZoomLevel(z => Math.max(0.5, z-0.1))} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">-</button>
                  <span className="text-[10px] text-slate-500 font-mono w-12 text-center">{Math.round(zoomLevel*100)}%</span>
                  <button onClick={() => setZoomLevel(z => Math.min(3, z+0.1))} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">+</button>
                </div>
              </div>
            </div>
            
            <div 
              ref={scrollContainerRef} 
              onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}
              className="flex-1 overflow-auto bg-[#0a0f1e] flex justify-center cursor-grab active:cursor-grabbing custom-scrollbar relative p-8"
            >
              <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }} className="mb-40 h-fit">
                {activeBook.type === 'pdf' && (
                  <iframe 
                    src={`${activeBook.mediaUrl}#page=${pdfPage}&toolbar=0&navpanes=0`} 
                    className="w-[850px] h-[1150px] bg-white rounded-lg shadow-2xl pointer-events-none border-none" 
                    title="PDF Viewer"
                  />
                )}
                {activeBook.type === 'image' && <img src={activeBook.mediaUrl} className="max-w-4xl shadow-2xl rounded-2xl" alt="Book media" />}
                {activeBook.type === 'video' && <video src={activeBook.mediaUrl} controls className="max-h-[75vh] rounded-2xl shadow-2xl" />}
              </div>

              {/* Enhanced PDF Navigation Controls */}
              {activeBook.type === 'pdf' && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 duration-500">
                  <button 
                    onClick={(e) => { e.stopPropagation(); const next = Math.max(1, pdfPage - 1); setPdfPage(next); setPageInput(next.toString()); }}
                    className="p-2.5 hover:bg-white/10 rounded-2xl transition-all disabled:opacity-20 group"
                    disabled={pdfPage <= 1}
                  >
                    <svg className="h-5 w-5 text-slate-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Page</span>
                    <input 
                      type="text" 
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value.replace(/\D/g,''))}
                      onBlur={handlePageJump}
                      onKeyDown={(e) => e.key === 'Enter' && handlePageJump()}
                      className="w-12 bg-slate-800 border border-white/10 rounded-xl px-2 py-1 text-center text-xs font-bold text-indigo-400 outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); const next = pdfPage + 1; setPdfPage(next); setPageInput(next.toString()); }}
                    className="p-2.5 hover:bg-white/10 rounded-2xl transition-all group"
                  >
                    <svg className="h-5 w-5 text-slate-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {showAiChat && (
            <div className="w-80 border-l border-white/5 bg-slate-900/80 backdrop-blur-md flex flex-col z-30">
              <header className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-950/20">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Co-Pilot</h3>
                </div>
                <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                </button>
              </header>

              {showSettings && (
                <div className="p-4 bg-slate-950/40 border-b border-white/5 space-y-4 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-widest">Auto-Translate</span>
                    <button 
                      onClick={() => setAutoTranslate(!autoTranslate)} 
                      className={`w-9 h-5 rounded-full transition-all relative ${autoTranslate ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${autoTranslate ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Target Language</label>
                    <select 
                      value={targetLanguage} 
                      onChange={e => setTargetLanguage(e.target.value)} 
                      className="w-full bg-slate-800 text-[10px] rounded-xl border border-white/10 p-2 text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50"
                    >
                      <option>Chinese</option><option>English</option><option>Japanese</option><option>Spanish</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-[11px] leading-relaxed">
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-xl grayscale opacity-50">🤖</div>
                    <p className="text-slate-500 italic">I can analyze your documents, translate pages, or answer questions. Try asking about a specific part of the text.</p>
                  </div>
                )}
                {chatHistory.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[90%] p-4 rounded-3xl ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800/80 text-slate-200 border border-white/5 shadow-inner'}`}>
                      {m.content}
                      {m.role === 'model' && (
                        <button onClick={() => speakText(m.content)} className="flex items-center gap-1.5 mt-3 text-[9px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-widest transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                          Speak Response
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isReading && (
                  <div className="flex items-center gap-3 text-[10px] text-indigo-400 font-black uppercase tracking-widest">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    Co-pilot is reading
                  </div>
                )}
              </div>

              <div className="p-5 bg-slate-950/40 border-t border-white/5">
                <div className="relative group">
                  <input 
                    value={aiQuestion} 
                    onChange={e => setAiQuestion(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleAnalyzeMedia()} 
                    placeholder="Ask Co-pilot..." 
                    className="w-full bg-slate-800 border border-white/5 rounded-2xl pl-5 pr-12 py-4 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600 shadow-inner" 
                  />
                  <button 
                    onClick={() => handleAnalyzeMedia()}
                    disabled={!aiQuestion.trim() || isReading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-30 flex items-center justify-center shadow-lg active:scale-95"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReaderView;
