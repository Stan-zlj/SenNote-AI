
import React, { useState, useRef, useEffect } from 'react';
import { Book } from '../types';
import { deepAnalysis, speakText, quickQuery } from '../services/geminiService';

interface ChatMessage { role: 'user' | 'model'; content: string; }

const ReaderView: React.FC<{ books: Book[], setBooks: (books: Book[]) => void }> = ({ books, setBooks }) => {
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoomLevel, setZoomLevel] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 文件上传处理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const newBook: Book = {
          id: Date.now().toString(),
          title: file.name,
          contentSnippet: `本地文件: ${file.name}`,
          progress: 0,
          type: 'pdf',
          mediaUrl: url
        };
        setBooks([newBook, ...books]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeMedia = async (type: 'chat' | 'summary' | 'quiz') => {
    if (!activeBook || !activeBook.mediaUrl) return;
    
    let prompt = aiQuestion;
    if (type === 'summary') prompt = "请用简洁的语言总结当前页面的核心内容，列出三个关键知识点。";
    if (type === 'quiz') prompt = "请基于当前页面内容，出 3 道单选题考察我的掌握程度，并附带答案解析。";
    
    if (!prompt.trim()) return;

    setAiQuestion('');
    setChatHistory(prev => [...prev, { role: 'user', content: prompt }]);
    setIsAiLoading(true);

    try {
      const base64 = activeBook.mediaUrl.split(',')[1];
      const result = await deepAnalysis([
        { inlineData: { data: base64, mimeType: 'application/pdf' } },
        { text: `[Context: Page ${pdfPage}] User Request: ${prompt}` }
      ]);
      if (result) setChatHistory(prev => [...prev, { role: 'model', content: result }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'model', content: "AI 出了一点状况，请重试。" }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {!activeBook ? (
        <div className="space-y-6 overflow-y-auto pb-10">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent uppercase tracking-wider">我的书库</h2>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth="3" strokeLinecap="round"/></svg>
              添加 PDF
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {books.length === 0 ? (
              <div className="col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-3xl text-slate-600 italic">
                还没有 PDF 资料，点击右上角添加。
              </div>
            ) : (
              books.map(b => (
                <div key={b.id} onClick={() => setActiveBook(b)} className="bg-slate-800/40 p-5 rounded-3xl border border-white/5 cursor-pointer hover:bg-indigo-600/10 hover:border-indigo-500/30 group transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-2xl">
                      {b.type === 'pdf' ? '📄' : '🖼️'}
                    </div>
                    <div className="overflow-hidden">
                      <span className="block font-bold text-slate-200 truncate">{b.title}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">{b.type}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl relative">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-3 border-b border-white/5 flex justify-between items-center bg-slate-900/60 backdrop-blur-md z-30">
              <button onClick={() => setActiveBook(null)} className="text-[10px] font-bold text-slate-400 hover:text-white uppercase flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                书库
              </button>
              <div className="flex gap-2">
                <button onClick={() => handleAnalyzeMedia('summary')} className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-500/30">总结当前页</button>
                <button onClick={() => handleAnalyzeMedia('quiz')} className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-[10px] font-bold hover:bg-purple-500/30">知识测试</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-[#0a0f1e] flex justify-center custom-scrollbar relative p-8">
              <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
                <iframe src={`${activeBook.mediaUrl}#page=${pdfPage}&toolbar=0`} className="w-[800px] h-[1100px] bg-white rounded-lg shadow-2xl" />
              </div>
              <div className="fixed bottom-8 left-1/3 flex items-center gap-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-3xl shadow-2xl">
                <button onClick={() => setPdfPage(Math.max(1, pdfPage-1))} className="text-slate-400">上页</button>
                <span className="text-xs font-bold text-white">第 {pdfPage} 页</span>
                <button onClick={() => setPdfPage(pdfPage+1)} className="text-slate-400">下页</button>
              </div>
            </div>
          </div>

          <div className="w-80 border-l border-white/5 bg-slate-900/80 backdrop-blur-md flex flex-col">
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-[11px]">
              {chatHistory.map((m, i) => (
                <div key={i} className={`p-4 rounded-2xl ${m.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/20' : 'bg-slate-800'}`}>
                  {m.content}
                </div>
              ))}
              {isAiLoading && <div className="text-indigo-400 animate-pulse uppercase font-black text-[9px] tracking-widest">AI 正在思考中...</div>}
            </div>
            <div className="p-4 bg-slate-950/40 border-t border-white/5">
              <input 
                value={aiQuestion} 
                onChange={e => setAiQuestion(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAnalyzeMedia('chat')}
                placeholder="问问 AI..." 
                className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-xs outline-none" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReaderView;
