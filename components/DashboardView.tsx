
import React, { useState, useEffect } from 'react';
import { fastQuery } from '../services/geminiService';

interface DashboardProps {
  timerSeconds: number;
  setTimerSeconds: (s: number) => void;
  isRunning: boolean;
  setIsRunning: (r: boolean) => void;
}

const DashboardView: React.FC<DashboardProps> = ({ timerSeconds, setTimerSeconds, isRunning, setIsRunning }) => {
  const [time, setTime] = useState(new Date());
  const [quickInput, setQuickInput] = useState('');
  const [quickResult, setQuickResult] = useState('');
  const [isFastLoading, setIsFastLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState('拷贝');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFastAsk = async () => {
    if (!quickInput.trim()) return;
    setIsFastLoading(true);
    setQuickResult('');
    const res = await fastQuery(quickInput);
    setQuickResult(res || '未收到回复');
    setIsFastLoading(false);
  };

  const handleCopy = () => {
    if (!quickResult) return;
    navigator.clipboard.writeText(quickResult);
    setCopyStatus('已拷贝');
    setTimeout(() => setCopyStatus('拷贝'), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-start h-full space-y-8 pt-4 px-2">
      <div className="text-center space-y-1">
        <div className="text-slate-500 text-[10px] font-black tracking-[0.4em] uppercase">
          {time.toISOString().split('T')[0]}
        </div>
        <div className="text-5xl font-black text-white tabular-nums tracking-tighter drop-shadow-2xl">
          {time.toLocaleTimeString('zh-CN', { hour12: false })}
        </div>
      </div>

      <div className="w-full bg-slate-800/40 border border-white/10 p-5 rounded-[32px] shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">极速闪回</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <input 
            value={quickInput}
            onChange={e => setQuickInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFastAsk()}
            placeholder="问事实、查单词..." 
            className="flex-1 bg-slate-900/60 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all"
          />
          <button 
            onClick={handleFastAsk}
            disabled={isFastLoading}
            className="bg-indigo-600 hover:bg-indigo-500 px-5 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg active:scale-95 disabled:opacity-30"
          >
            {isFastLoading ? "..." : "ASK"}
          </button>
        </div>
        
        {quickResult && (
          <div className="relative group animate-in slide-in-from-top-2">
            <div className={`p-4 rounded-2xl border border-white/5 text-[11px] leading-relaxed max-h-40 overflow-y-auto custom-scrollbar whitespace-pre-wrap ${quickResult.includes('失败') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-slate-900/80 text-slate-300'}`}>
              {quickResult}
            </div>
            <button 
              onClick={handleCopy}
              className="absolute top-2 right-2 bg-indigo-600/80 hover:bg-indigo-600 text-[9px] font-bold text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copyStatus}
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[320px] bg-slate-800/40 border border-white/10 p-8 rounded-[48px] flex flex-col items-center space-y-6 shadow-2xl backdrop-blur-xl relative group">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/20"></div>
        <div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">专注计时器</div>
        <div className="text-5xl font-mono font-bold text-white mb-2 tabular-nums">
          {Math.floor(timerSeconds/3600).toString().padStart(2, '0')}:
          {Math.floor((timerSeconds%3600)/60).toString().padStart(2, '0')}:
          {(timerSeconds%60).toString().padStart(2, '0')}
        </div>
        {!isRunning ? (
           <button onClick={() => { setTimerSeconds(25*60); setIsRunning(true); }} className="bg-indigo-600 px-10 py-3 rounded-2xl text-[10px] font-black uppercase">开启 25MIN 专注</button>
        ) : (
          <button onClick={() => setIsRunning(false)} className="bg-red-500 px-10 py-3 rounded-2xl text-[10px] font-black uppercase">停止</button>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
