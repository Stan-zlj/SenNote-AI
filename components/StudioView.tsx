
import React, { useState, useRef, useEffect } from 'react';

const StudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio'>('image');
  const [mediaBlob, setMediaBlob] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 粘贴图片处理
  useEffect(() => {
    if (activeTab !== 'image') return;
    const handlePaste = (e: ClipboardEvent) => {
      const item = e.clipboardData?.items[0];
      if (item?.type.includes('image')) {
        const blob = item.getAsFile();
        if (blob) setMediaBlob(URL.createObjectURL(blob));
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab]);

  // 自动绑定预览流
  useEffect(() => {
    if (activeTab === 'video' && recording && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [recording, activeTab]);

  const getSupportedMimeType = (type: 'video' | 'audio') => {
    const types = type === 'video' 
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] 
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  };

  const startMedia = async (type: 'video' | 'audio') => {
    setIsInitializing(true);
    setMediaBlob(null);
    chunksRef.current = [];

    try {
      const constraints = type === 'video' 
        ? { video: { width: 1280, height: 720 }, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeType = getSupportedMimeType(type);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || (type === 'video' ? 'video/webm' : 'audio/webm') });
        const url = URL.createObjectURL(blob);
        setMediaBlob(url);
        // 彻底关闭硬件流
        stream.getTracks().forEach(track => track.stop());
      };

      recorderRef.current = recorder;
      recorder.start(100); // 每100ms收集一次数据
      setRecording(true);
    } catch (err) {
      console.error("Hardware access error:", err);
      alert("无法访问硬件。请检查摄像头/麦克风权限或是否被占用。");
    } finally {
      setIsInitializing(false);
    }
  };

  const stopMedia = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const downloadMedia = () => {
    if (!mediaBlob) return;
    const a = document.createElement('a');
    a.href = mediaBlob;
    a.download = `ZenNote_${activeTab}_${new Date().getTime()}.${activeTab === 'audio' ? 'webm' : 'webm'}`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <header>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          多媒体工坊
          {recording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        </h2>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Media Studio</p>
      </header>

      <div className="flex bg-slate-800/40 p-1 rounded-2xl w-fit border border-white/5">
        {(['image', 'video', 'audio'] as const).map((tab) => (
          <button
            key={tab}
            disabled={recording}
            onClick={() => { setActiveTab(tab); setMediaBlob(null); }}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30'}`}
          >
            {tab === 'image' ? '图片' : tab === 'video' ? '视频' : '语音'}
          </button>
        ))}
      </div>

      <div className="aspect-video bg-slate-950 rounded-[32px] border border-white/5 flex items-center justify-center overflow-hidden relative group shadow-inner">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05),transparent)] pointer-events-none" />

        {isInitializing && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">正在启动硬件...</p>
          </div>
        )}

        {!isInitializing && activeTab === 'image' && (
          mediaBlob ? (
            <img src={mediaBlob} className="max-h-full object-contain p-4" alt="Pasted" />
          ) : (
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-slate-900 rounded-3xl mx-auto mb-4 flex items-center justify-center text-2xl">🖼️</div>
              <p className="text-sm text-slate-400">点击上传或 <span className="text-indigo-400 font-bold">Ctrl+V</span> 粘贴图片</p>
              <input type="file" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setMediaBlob(URL.createObjectURL(f));
              }} className="mt-6 text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-indigo-600/20 file:text-indigo-400 hover:file:bg-indigo-600/30" />
            </div>
          )
        )}

        {!isInitializing && activeTab === 'video' && (
          recording ? (
            <video ref={videoRef} autoPlay muted className="w-full h-full object-cover mirror" />
          ) : (
            mediaBlob ? (
              <video src={mediaBlob} controls className="w-full h-full object-contain" />
            ) : (
              <button onClick={() => startMedia('video')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">开启摄像头</button>
            )
          )
        )}

        {!isInitializing && activeTab === 'audio' && (
          recording ? (
            <div className="flex flex-col items-center gap-6">
               <div className="relative">
                 <div className="w-20 h-20 bg-indigo-500/20 rounded-full animate-ping absolute inset-0" />
                 <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-2xl relative z-10 shadow-indigo-500/50 shadow-2xl">🎙️</div>
               </div>
               <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-xs animate-pulse">正在录音</p>
            </div>
          ) : (
            mediaBlob ? (
              <div className="w-full max-w-xs px-6 py-10 bg-slate-900/50 rounded-3xl border border-white/5 flex flex-col items-center gap-4">
                <audio src={mediaBlob} controls className="w-full" />
                <span className="text-[10px] text-slate-500 uppercase font-bold">预览录音文件</span>
              </div>
            ) : (
              <button onClick={() => startMedia('audio')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">开始录音</button>
            )
          )
        )}

        {recording && (
          <button onClick={stopMedia} className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-500 text-white px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 border-b-4 border-red-800">
            完成录制
          </button>
        )}
      </div>

      {mediaBlob && !recording && (
        <div className="flex justify-between items-center bg-indigo-600/5 p-4 rounded-2xl border border-indigo-500/20 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600/20 rounded-xl flex items-center justify-center">✅</div>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">文件已生成</span>
          </div>
          <div className="flex gap-4">
             <button onClick={() => setMediaBlob(null)} className="text-[10px] font-bold text-slate-500 hover:text-white uppercase transition-colors">重新录制</button>
             <button onClick={downloadMedia} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all">保存本地</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudioView;
