
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

const StudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio' | 'veo'>('image');
  const [mediaBlob, setMediaBlob] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Veo Video Generation States
  const [veoPrompt, setVeoPrompt] = useState('');
  const [veoRatio, setVeoRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isVeoGenerating, setIsVeoGenerating] = useState(false);
  const [veoProgress, setVeoProgress] = useState('');

  // 设备枚举
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 获取可用设备列表
  const refreshDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vds = devices.filter(d => d.kind === 'videoinput');
      setVideoDevices(vds);
      if (vds.length > 0 && !selectedVideoId) {
        setSelectedVideoId(vds[0].deviceId);
      }
    } catch (e) {
      console.error("Enumerate devices failed", e);
    }
  };

  useEffect(() => {
    refreshDevices();
  }, []);

  const releaseHardware = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  useEffect(() => {
    return () => releaseHardware();
  }, []);

  const startMedia = async (type: 'video' | 'audio') => {
    setIsInitializing(true);
    setErrorMsg(null);
    setMediaBlob(null);
    chunksRef.current = [];
    releaseHardware();

    try {
      const constraints: MediaStreamConstraints = type === 'video' 
        ? { 
            video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true, 
            audio: true 
          }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (type === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(console.error);
      }

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: type === 'video' ? 'video/webm' : 'audio/webm' });
        setMediaBlob(URL.createObjectURL(finalBlob));
        releaseHardware();
      };

      recorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
    } catch (err: any) {
      console.error("Hardware Error:", err);
      let msg = "硬件无法启动。";
      if (err.name === 'NotReadableError') {
        msg = "摄像头被占用或笔记本已合盖。请检查隐私开关、F8 快捷键，或尝试切换摄像头。";
      } else if (err.name === 'NotAllowedError') {
        msg = "系统权限已拒绝。请检查 Windows/macOS 隐私设置。";
      }
      setErrorMsg(msg);
      releaseHardware();
    } finally {
      setIsInitializing(false);
    }
  };

  const stopMedia = () => {
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    setRecording(false);
  };

  // Veo Generation
  const generateVeoVideo = async () => {
    if (!veoPrompt.trim()) return;
    
    // Check API Key Selection (Mandatory for Veo)
    const win = window as any;
    if (win.aistudio && typeof win.aistudio.hasSelectedApiKey === 'function') {
      const hasKey = await win.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setVeoProgress("请先选择付费 API Key 以使用视频生成功能。正在打开选择窗口...");
        await win.aistudio.openSelectKey();
        // Proceeding after openSelectKey is assumed success per instructions
      }
    }

    setIsVeoGenerating(true);
    setVeoProgress("正在联系智影创作中心 (Veo 3)...");
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: veoPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: veoRatio
        }
      });

      setVeoProgress("正在激发 AI 灵感，这可能需要几分钟...");
      
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        setVeoProgress("AI 正在精心渲染您的创意视频...");
        try {
          operation = await ai.operations.getVideosOperation({ operation: operation });
        } catch (opErr: any) {
          if (opErr.message?.includes("Requested entity was not found")) {
            setVeoProgress("密钥授权失效，请重新选择。");
            if (win.aistudio) await win.aistudio.openSelectKey();
            throw opErr;
          }
          throw opErr;
        }
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const videoRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const videoBlob = await videoRes.blob();
        setMediaBlob(URL.createObjectURL(videoBlob));
        setVeoProgress("视频创作完成！");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`视频生成失败: ${err.message}`);
    } finally {
      setIsVeoGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 h-full flex flex-col">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            多媒体工坊 {recording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </h2>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Media Lab</p>
        </div>
        
        {activeTab === 'video' && !recording && videoDevices.length > 1 && (
          <select 
            value={selectedVideoId}
            onChange={(e) => setSelectedVideoId(e.target.value)}
            className="bg-slate-800 text-slate-300 text-[10px] px-3 py-1 rounded-lg border border-white/10 outline-none"
          >
            {videoDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `摄像头 ${videoDevices.indexOf(d) + 1}`}</option>
            ))}
          </select>
        )}
      </header>

      <div className="flex bg-slate-800/40 p-1 rounded-2xl w-fit border border-white/5">
        {(['image', 'video', 'audio', 'veo'] as const).map((tab) => (
          <button
            key={tab}
            disabled={recording || isVeoGenerating}
            onClick={() => { setActiveTab(tab); setMediaBlob(null); setErrorMsg(null); releaseHardware(); }}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30'}`}
          >
            {tab === 'image' ? '图片' : tab === 'video' ? '录影' : tab === 'audio' ? '录音' : 'AI 视频'}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'veo' ? (
          <div className="space-y-4 h-full flex flex-col">
            <div className="bg-slate-800/30 border border-white/5 p-5 rounded-3xl space-y-4">
              <textarea
                value={veoPrompt}
                onChange={e => setVeoPrompt(e.target.value)}
                placeholder="描述你想要的视频场景，例如：一根赛博朋克风格的霓虹发光羽毛在空中缓慢飘落..."
                className="w-full h-24 bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => setVeoRatio('16:9')} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${veoRatio === '16:9' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 text-slate-500'}`}>16:9 横屏</button>
                  <button onClick={() => setVeoRatio('9:16')} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${veoRatio === '9:16' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 text-slate-500'}`}>9:16 竖屏</button>
                </div>
                <button 
                  onClick={generateVeoVideo} 
                  disabled={isVeoGenerating || !veoPrompt.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all disabled:opacity-50"
                >
                  {isVeoGenerating ? '生成中...' : '开始生成'}
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 rounded-[32px] border border-white/5 flex items-center justify-center overflow-hidden relative shadow-inner">
              {mediaBlob ? (
                <video src={mediaBlob} controls className="w-full h-full object-contain" />
              ) : isVeoGenerating ? (
                <div className="text-center p-8 space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest max-w-[200px] leading-relaxed">{veoProgress}</p>
                </div>
              ) : (
                <div className="text-center p-8 text-slate-600 italic">
                   <p className="text-4xl mb-4">🎬</p>
                   <p className="text-xs">描述你的创意，AI 将其转化为现实</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-slate-950 rounded-[32px] border border-white/5 flex items-center justify-center overflow-hidden relative group shadow-inner h-full max-h-[400px]">
            <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover mirror ${activeTab === 'video' && recording ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
            
            {mediaBlob && (activeTab === 'video' || activeTab === 'audio') && !recording && (
              activeTab === 'video' ? <video src={mediaBlob} controls className="w-full h-full object-contain bg-black z-10" />
              : <div className="z-10 bg-slate-900 p-8 rounded-3xl border border-white/10 w-full max-w-[300px] text-center"><audio src={mediaBlob} controls className="w-full" /><p className="text-[10px] text-slate-500 mt-4 font-black uppercase tracking-widest">录音已保存</p></div>
            )}

            {!recording && !mediaBlob && !errorMsg && !isInitializing && (
              <div className="text-center p-8 z-20">
                <div className="w-16 h-16 bg-slate-900 rounded-3xl mx-auto mb-4 flex items-center justify-center text-2xl">
                  {activeTab === 'image' ? '🖼️' : activeTab === 'video' ? '📹' : '🎙️'}
                </div>
                {activeTab === 'image' ? (
                  <p className="text-sm text-slate-400">请粘贴资料或上传文件</p>
                ) : (
                  <button onClick={() => startMedia(activeTab as any)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">
                    {activeTab === 'video' ? '唤醒拍摄设备' : '唤醒录音设备'}
                  </button>
                )}
              </div>
            )}

            {isInitializing && <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 z-30">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">正在连接硬件传感器...</p>
            </div>}

            {errorMsg && (
              <div className="absolute inset-0 bg-slate-950/95 p-10 flex flex-col items-center justify-center text-center z-40">
                <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 text-2xl">⚠️</div>
                <p className="text-xs text-red-400 font-bold leading-relaxed max-w-[280px]">{errorMsg}</p>
                <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-[280px]">
                  <div className="p-3 bg-slate-900 rounded-xl border border-white/5">
                    <p className="text-[8px] text-slate-500 uppercase font-black mb-1">物理检查</p>
                    <p className="text-[10px] text-slate-300">确保摄像头推拉窗开启，按 F8 激活权限。</p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-white/5">
                    <p className="text-[8px] text-slate-500 uppercase font-black mb-1">环境检查</p>
                    <p className="text-[10px] text-slate-300">如果使用外接屏，请保持笔记本盖子处于开启状态。</p>
                  </div>
                </div>
                <button onClick={() => startMedia(activeTab as any)} className="mt-8 bg-indigo-600 text-white px-8 py-2 rounded-xl text-[10px] font-black uppercase">重新检测设备</button>
              </div>
            )}

            {recording && <button onClick={stopMedia} className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-500 text-white px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 border-b-4 border-red-800 z-50">
              停止并保存
            </button>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudioView;
