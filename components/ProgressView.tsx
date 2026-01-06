
import React from 'react';
import { DailyCheckIn } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ProgressViewProps {
  checkIns: DailyCheckIn[];
  toggleCheckIn: () => void;
}

const ProgressView: React.FC<ProgressViewProps> = ({ checkIns, toggleCheckIn }) => {
  const today = new Date().toISOString().split('T')[0];
  const hasCheckedInToday = checkIns.some(c => c.date === today);

  const chartData = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().split('T')[0];
    return {
      name: dateStr.slice(5),
      checked: checkIns.some(c => c.date === dateStr) ? 1 : 0,
    };
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Study Dashboard</h2>
        <p className="text-slate-400 text-sm">Visualize your learning consistency.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/40 border border-white/10 p-6 rounded-3xl flex flex-col items-center justify-center shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-indigo-500/20 transition-all"></div>
          <span className="text-4xl font-black text-white">{checkIns.length}</span>
          <span className="text-[10px] text-slate-500 uppercase font-black mt-2 tracking-widest">Completed Sessions</span>
        </div>
        <div className="bg-slate-800/40 border border-white/10 p-6 rounded-3xl flex flex-col items-center justify-center shadow-lg relative overflow-hidden group">
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl -ml-12 -mb-12 group-hover:bg-purple-500/20 transition-all"></div>
          <span className="text-4xl font-black text-indigo-400">
            {checkIns.length > 0 ? (checkIns.length > 5 ? 'Elite' : 'Active') : 'Ready'}
          </span>
          <span className="text-[10px] text-slate-500 uppercase font-black mt-2 tracking-widest">Focus Status</span>
        </div>
      </div>

      <div className="bg-slate-800/20 border border-white/5 rounded-3xl p-6 shadow-inner">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Consistency Heatmap (14 Days)</h3>
          <div className="flex gap-1">
             {Array.from({length: 3}).map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500/40 animate-pulse" style={{animationDelay: `${i * 200}ms`}}></div>)}
          </div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorChecked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="name" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} tickMargin={10} />
              <YAxis hide domain={[0, 1.2]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold' }}
                itemStyle={{ color: '#818cf8' }}
                cursor={{ stroke: '#6366f1', strokeWidth: 1 }}
              />
              <Area type="step" dataKey="checked" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorChecked)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pt-6 relative">
        <button
          onClick={toggleCheckIn}
          disabled={hasCheckedInToday}
          className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 group relative overflow-hidden shadow-2xl ${
            hasCheckedInToday 
            ? 'bg-slate-800/40 text-slate-500 border border-white/5 cursor-not-allowed grayscale' 
            : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white hover:scale-[1.01] active:scale-95 hover:shadow-indigo-500/20'
          }`}
        >
          {hasCheckedInToday ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              Daily Goal Accomplished
            </>
          ) : (
            <>
              <span>Log Study Session</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
        {!hasCheckedInToday && (
          <p className="text-center text-[10px] text-slate-500 mt-4 uppercase font-bold tracking-[0.2em] animate-pulse">
            Consistency is the bridge between goals and accomplishment.
          </p>
        )}
      </div>
    </div>
  );
};

export default ProgressView;
