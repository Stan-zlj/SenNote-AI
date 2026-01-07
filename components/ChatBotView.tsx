
import React, { useState, useEffect, useRef } from 'react';
import { createChat } from '../services/geminiService';

const ChatBotView: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current = createChat("You are a helpful and brilliant academic assistant for Stan. Keep responses clear and deep.");
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const result = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: result.text }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: "对不起，我现在无法回答。请检查网络或 API Key。" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <header>
        <h2 className="text-xl font-bold text-white">智学对话</h2>
        <p className="text-slate-500 text-xs">使用 Gemini 3 Pro 提供深度学术支持。</p>
      </header>

      <div className="flex-1 bg-slate-950/50 rounded-3xl border border-white/5 p-6 overflow-y-auto custom-scrollbar flex flex-col space-y-4">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-sm">
            <span className="text-4xl mb-2">💬</span>
            <p>随时向我提问，我会为你深入浅出地讲解。</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user' 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none border border-white/5">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="问问 Gemini 3 Pro..."
          className="flex-1 bg-slate-800 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-2xl font-bold transition-all disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
};

export default ChatBotView;
