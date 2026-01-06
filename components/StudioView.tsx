
import React, { useState, useRef, useEffect } from 'react';

const StudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio'>('image');
  const [mediaBlob, setMediaBlob] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 粘贴图片处理
  useEffect(() => {
    if (activeTab !== 'image') return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const item = Array.from(items).find(i => i.type.includes('image'));
      if (item) {
        const blob = item.getAsFile();
        if (blob) setMediaBlob(URL.createObjectURL(blob));
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab]);

  const getSupportedMimeType = (type: 'video' | 'audio') => {
    const types = type === 'video' 
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] 
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/wav'];
    const supported = types.find(t => MediaRecorder.isTypeSupported(t));
    return supported || '';
  };

  const startMedia = async (type: 'video' | 'audio') => {
    console.log(`Starting ${type} capture...`);
    setIsInitializing(true);
    setErrorMsg(null);
    setMediaBlob(null);
    chunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("当前环境不支持媒体访问 (MediaDevices API missing)");
      }

      const constraints: MediaStreamConstraints = type === 'video' 
        ? { 
            video: { 
              width: { ideal: 1280 }, 
              height: { ideal: 720 },
              facingMode: "user"
            }, 
            audio: true 
          }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // 检查流是否有效
      const tracks = stream.getTracks();
      if (tracks.length === 0) {
        throw new Error("未能捕获到有效的媒体轨道。");
      }
      
      console.log("Hardware tracks active:", tracks.map(t => `${t.kind}:${t.label}`));

      // 绑定视频预览
      if (type === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
        // 显式触发 play()
        try {
          await videoRef.current.play();
          console.log("Preview video playing.");
        } catch (playErr) {
          console.error("Video play failed:", playErr);
        }
      }

      const mimeType = getSupportedMimeType(type);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { 
          type: mimeType || (type === 'video' ? 'video/webm' : 'audio/webm') 
        });
        const url = URL.createObjectURL(finalBlob);
        setMediaBlob(url);
        
        // 彻底释放流
        stream.getTracks().forEach(track => {
          track.stop();
          console.log(`Track stopped: ${track.label}`);
        });
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
      };

      recorderRef.current = recorder;
      recorder.start(500); // 间隔切片以确保稳定性
      setRecording(true);
      console.log("MediaRecorder started.");
    } catch (err: any) {
      console.error("Hardware initialization failed:", err);
      let friendlyMsg = "硬件启动失败";
      if (err.name === 'NotAllowedError') friendlyMsg = "权限被拒绝，请检查系统隐私设置。";
      else if (err.name === 'NotFoundError') friendlyMsg = "未找到可用的摄像头或麦克风设备。";
      else if (err.name === 'NotReadableError') friendlyMsg = "设备被其他程序占用，无法启动。";
      
      setErrorMsg(`${friendlyMsg} (${err.message})`);
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
    a.download = `ZenNote_${activeTab}_${Date.now()}.${activeTab === 'audio' ? 'webm' : 'webm'}`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <header>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          多媒体工坊
          {recording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        </h2>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Media Hub</p>
      </header>

      <div className="flex bg-slate-800/40 p-1 rounded-2xl w-fit border border-white/5">
        {(['image', 'video', 'audio'] as const).map((tab) => (
          <button
            key={tab}
            disabled={recording}
            onClick={() => { setActiveTab(tab); setMediaBlob(null); setErrorMsg(null); }}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30'}`}
          >
            {tab === 'image' ? '图片' : tab === 'video' ? '视频' : '语音'}
          </button>
        ))}
      </div>

      <div className="aspect-video bg-slate-950 rounded-[32px] border border-white/5 flex items-center justify-center overflow-hidden relative group shadow-inner">
        
        {/* 持久化的预览层 - 仅在视频且录像中/预览中显示 */}
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className={`absolute inset-0 w-full h-full object-cover mirror ${activeTab === 'video' && recording ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />

        {/* 录制后的回放层 */}
        {mediaBlob && activeTab === 'video' && !recording && (
          <video src={mediaBlob} controls className="w-full h-full object-contain bg-black z-10" />
        )}

        {/* 音频状态层 */}
        {activeTab === 'audio' && recording && (
          <div className="flex flex-col items-center gap-6 z-10">
            <div className="relative">
              <div className="w-20 h-20 bg-indigo-500/20 rounded-full animate-ping absolute inset-0" />
              <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-2xl relative z-10 shadow-indigo-500/50 shadow-2xl">🎙️</div>
            </div>
            <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-xs animate-pulse">正在捕捉音频信号...</p>
          </div>
        )}

        {/* 图片显示层 */}
        {activeTab === 'image' && mediaBlob && (
          <img src={mediaBlob} className="max-h-full object-contain p-4 z-10" alt="Material" />
        )}

        {/* 交互引导层 */}
        {!recording && !mediaBlob && !errorMsg && !isInitializing && (
          <div className="text-center p-8 z-20">
            <div className="w-16 h-16 bg-slate-900 rounded-3xl mx-auto mb-4 flex items-center justify-center text-2xl">
              {activeTab === 'image' ? '🖼️' : activeTab === 'video' ? '📹' : '🎙️'}
            </div>
            {activeTab === 'image' ? (
              <>
                <p className="text-sm text-slate-400">粘贴或上传学习资料</p>
                <input type="file" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setMediaBlob(URL.createObjectURL(f));
                }} className="mt-6 text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-indigo-600/20 file:text-indigo-400" />
              </>
            ) : (
              <button 
                onClick={() => startMedia(activeTab as any)} 
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
              >
                {activeTab === 'video' ? '唤醒摄像头' : '唤醒麦克风'}
              </button>
            )}
          </div>
        )}

        {/* 加载中层 */}
        {isInitializing && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 z-30">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">正在建立硬件连接...</p>
          </div>
        )}

        {/* 报错层 */}
        {errorMsg && (
          <div className="absolute inset-0 bg-slate-950/90 p-8 flex flex-col items-center justify-center text-center z-40">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4 text-xl">⚠️</div>
            <p className="text-xs text-red-400 font-bold leading-relaxed">{errorMsg}</p>
            <button onClick={() => startMedia(activeTab as any)} className="mt-6 bg-slate-800 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">再次尝试</button>
          </div>
        )}

        {/* 录制中控制 */}
        {recording && (
          <button onClick={stopMedia} className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-500 text-white px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 border-b-4 border-red-800 z-50">
            结束并生成
          </button>
        )}
      </div>

      {/* 底部操作栏 */}
      {mediaBlob && !recording && (
        <div className="flex justify-between items-center bg-indigo-600/5 p-4 rounded-2xl border border-indigo-500/20 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600/20 rounded-xl flex items-center justify-center text-xs">✅</div>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">素材已就绪</span>
          </div>
          <div className="flex gap-4">
             <button onClick={() => { setMediaBlob(null); setErrorMsg(null); }} className="text-[10px] font-bold text-slate-500 hover:text-white uppercase transition-colors">重新捕获</button>
             <button onClick={downloadMedia} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all">存至笔记库</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudioView;
