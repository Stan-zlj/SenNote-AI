
import React, { useState, useRef } from 'react';
import { generateMindMap } from '../services/geminiService';
import { MindMapNode } from '../types';

const NodeComponent: React.FC<{ node: MindMapNode, x: number, y: number, depth: number }> = ({ node, x, y, depth }) => {
  const childSpacing = 160;
  const horizontalGap = 200;

  return (
    <g>
      <rect x={x - 60} y={y - 20} width={120} height={40} rx={10} fill={depth === 0 ? "#6366f1" : "#1e293b"} stroke="#4f46e5" strokeWidth={2} />
      <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">{node.label}</text>
      
      {node.children?.map((child, i) => {
        const startY = y - ((node.children!.length - 1) * childSpacing) / 2;
        const childY = startY + i * childSpacing;
        const childX = x + horizontalGap;
        
        return (
          <React.Fragment key={i}>
            <path d={`M ${x + 60} ${y} C ${x + 130} ${y}, ${x + 130} ${childY}, ${childX - 60} ${childY}`} stroke="#4f46e5" strokeWidth={2} fill="none" opacity={0.5} />
            <NodeComponent node={child} x={childX} y={childY} depth={depth + 1} />
          </React.Fragment>
        );
      })}
    </g>
  );
};

const MindMapView: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MindMapNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const result = await generateMindMap(input);
    if (result) setData(result);
    setLoading(false);
  };

  const exportAsImage = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const svgSize = svgRef.current.getBBox();
    canvas.width = svgSize.width + 100;
    canvas.height = svgSize.height + 100;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 50, 50);
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `MindMap_${Date.now()}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <header>
        <h2 className="text-xl font-bold text-white">AI 思维导图</h2>
        <p className="text-slate-500 text-xs">输入主题，AI 自动为您梳理知识架构。</p>
      </header>

      <div className="flex gap-2">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)}
          placeholder="例如：量子力学基础、React 学习路线..." 
          className="flex-1 bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-indigo-500" 
        />
        <button 
          onClick={handleGenerate} 
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        >
          {loading ? '生成中...' : '生成导图'}
        </button>
      </div>

      <div className="flex-1 bg-slate-950 rounded-3xl border border-white/5 overflow-auto custom-scrollbar relative">
        {data ? (
          <>
            <div className="p-10 min-w-max">
              <svg ref={svgRef} width={2000} height={1000} className="mx-auto">
                <NodeComponent node={data} x={100} y={500} depth={0} />
              </svg>
            </div>
            <button 
              onClick={exportAsImage} 
              className="absolute top-6 right-6 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-bold border border-white/10 uppercase tracking-widest"
            >
              导出图片
            </button>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">
            <span className="text-4xl mb-4">🧠</span>
            <p>在上方输入主题，点击生成开始探索</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMapView;
