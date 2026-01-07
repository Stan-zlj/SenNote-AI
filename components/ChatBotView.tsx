
import React, { useState, useEffect, useRef } from 'react';
import { createChat } from '../services/geminiService';

const ChatBotView: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      // 明确使用 gemini-3-pro-preview 
      chatRef.current = createChat("你是一名博学、耐心的学术导师 Stan。你会用深入浅出的方式解答问题，逻辑清晰且富有启发性。");
    } catch (e) {
      console.error("Chat init failed", e);
      setError("对话初始化失败，请检查 API 配置。");
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading || !chatRef.current) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const result = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: result.text }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: "导师正在忙碌，请稍后再试或检查网络状态。" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0 animate-in fade-in duration-500">
      <header className="shrink-0">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          智学对话 <span className="text-[9px] bg-white/10 text-slate-400 px-2 py-0.5 rounded-full uppercase tracking-tighter">Pro Model</span>
        </h2>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Deep Reasoning Academic AI</p>
      </header>

      <div className="flex-1 min-h-0 bg-slate-950/50 rounded-[32px] border border-white/5 p-6 overflow-y-auto custom-scrollbar flex flex-col space-y-4">
        {messages.length === 0 && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-sm">
            <span className="text-4xl mb-4">📘</span>
            <p className="text-xs uppercase tracking-widest font-bold">我是你的学术导师，今天想探讨什么？</p>
          </div>
        )}
        
        {error && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-red-400 text-xs font-bold">{error}</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] px-5 py-3.5 rounded-[22px] text-sm leading-relaxed ${
              m.role === 'user' 
              ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-500/10' 
              : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 px-5 py-3.5 rounded-[22px] rounded-tl-none border border-white/5">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} className="h-2 shrink-0" />
      </div>

      <div className="flex gap-2 shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="问问导师 Stan (Gemini 3 Pro)..."
          className="flex-1 bg-slate-800 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim() || !!error}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl disabled:opacity-30 active:scale-95"
        >
          发送
        </button>
      </div>
    </div>
  );
};

export default ChatBotView;
