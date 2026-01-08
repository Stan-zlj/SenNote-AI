
import React, { useState, useEffect, useRef } from 'react';
import { createChat } from '../services/geminiService';

const ChatBotView: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      chatRef.current = createChat("你是一名博学、耐心的学术导师 Stan。你会用深入浅出的方式解答问题。");
    } catch (e) {}
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      setMessages(prev => [...prev, { role: 'model', text: "导师忙碌中，请检查网络。" }]);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0 select-text">
      <header className="shrink-0 select-none">
        <h2 className="text-xl font-black text-white">智学对话</h2>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Academic Pro Model</p>
      </header>

      <div className="flex-1 min-h-0 bg-slate-950/50 rounded-[32px] border border-white/5 p-6 overflow-y-auto custom-scrollbar flex flex-col space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="group relative max-w-[90%]">
              <div className={`px-5 py-3.5 rounded-[22px] text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
              }`}>
                {m.text}
              </div>
              <button 
                onClick={() => copyText(m.text)}
                className={`absolute -top-6 ${m.role === 'user' ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 bg-slate-800 p-1 rounded-lg text-[8px] uppercase font-bold text-slate-400 hover:text-white transition-all`}
              >
                拷贝内容
              </button>
            </div>
          </div>
        ))}
        {loading && <div className="text-indigo-400 text-[10px] font-black animate-pulse">STAN 正在思考...</div>}
        <div ref={scrollRef} className="h-2" />
      </div>

      <div className="flex gap-2 shrink-0 select-none">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="问问导师 Stan..."
          className="flex-1 bg-slate-800 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button onClick={handleSend} disabled={loading || !input.trim()} className="bg-indigo-600 px-8 rounded-2xl font-black text-xs uppercase shadow-xl">发送</button>
      </div>
    </div>
  );
};

export default ChatBotView;
