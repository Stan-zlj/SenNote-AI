
import React, { useState, useEffect } from 'react';

interface DashboardProps {
  timerSeconds: number;
  setTimerSeconds: (s: number) => void;
  isRunning: boolean;
  setIsRunning: (r: boolean) => void;
}

const DashboardView: React.FC<DashboardProps> = ({ timerSeconds, setTimerSeconds, isRunning, setIsRunning }) => {
  const [time, setTime] = useState(new Date());
  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const startTimer = () => {
    const total = (inputHours * 3600) + (inputMinutes * 60);
    if (total > 0) {
      setTimerSeconds(total);
      setIsRunning(true);
    }
  };

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-10 animate-in fade-in duration-700">
      <div className="text-center space-y-3">
        <div className="text-slate-400 text-sm font-black tracking-[0.4em] uppercase">
          {formatDate(time)}
        </div>
        <div className="text-7xl font-black text-white tabular-nums tracking-tighter drop-shadow-2xl">
          {time.toLocaleTimeString('zh-CN', { hour12: false })}
        </div>
      </div>

      <div className="w-full max-w-[320px] bg-slate-800/40 border border-white/10 p-8 rounded-[48px] flex flex-col items-center space-y-6 shadow-2xl backdrop-blur-xl relative group">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/20 group-hover:bg-indigo-500/40 transition-all"></div>
        <div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">专注计时 (24小时)</div>
        
        {timerSeconds > 0 || isRunning ? (
          <div className="text-5xl font-mono font-bold text-white mb-2 tabular-nums">
            {formatTimer(timerSeconds)}
          </div>
        ) : (
          <div className="flex gap-4 items-center">
            <div className="flex flex-col items-center">
              <input 
                type="number" min="0" max="23" value={inputHours} 
                onChange={e => setInputHours(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-16 bg-slate-900/80 border border-white/10 rounded-2xl p-3 text-center text-2xl font-bold text-indigo-400 outline-none focus:ring-2"
              />
              <span className="text-[10px] text-slate-500 mt-2 uppercase font-black">时</span>
            </div>
            <span className="text-slate-700 text-2xl font-bold mb-6">:</span>
            <div className="flex flex-col items-center">
              <input 
                type="number" min="0" max="59" value={inputMinutes} 
                onChange={e => setInputMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-16 bg-slate-900/80 border border-white/10 rounded-2xl p-3 text-center text-2xl font-bold text-indigo-400 outline-none focus:ring-2"
              />
              <span className="text-[10px] text-slate-500 mt-2 uppercase font-black">分</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 w-full">
          {!isRunning ? (
            <button 
              onClick={startTimer}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-3xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95"
            >
              开始专注
            </button>
          ) : (
            <>
              <button 
                onClick={() => setIsRunning(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-3xl font-black text-xs uppercase"
              >
                暂停
              </button>
              <button 
                onClick={() => { setIsRunning(false); setTimerSeconds(0); }}
                className="px-6 bg-red-500/20 hover:bg-red-500/40 text-red-400 py-4 rounded-3xl font-black text-xs uppercase"
              >
                重置
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
