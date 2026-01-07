
import React, { useState, useRef, useEffect } from 'react';

const StudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio'>('image');
  const [mediaBlob, setMediaBlob] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            多媒体工坊 {recording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </h2>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Media Lab</p>
        </div>
        
        {/* 摄像头选择器 */}
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
        {(['image', 'video', 'audio'] as const).map((tab) => (
          <button
            key={tab}
            disabled={recording}
            onClick={() => { setActiveTab(tab); setMediaBlob(null); setErrorMsg(null); releaseHardware(); }}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30'}`}
          >
            {tab === 'image' ? '图片' : tab === 'video' ? '视频' : '语音'}
          </button>
        ))}
      </div>

      <div className="aspect-video bg-slate-950 rounded-[32px] border border-white/5 flex items-center justify-center overflow-hidden relative group shadow-inner">
        <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover mirror ${activeTab === 'video' && recording ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
        
        {mediaBlob && activeTab === 'video' && !recording && <video src={mediaBlob} controls className="w-full h-full object-contain bg-black z-10" />}

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
                <p className="text-[8px] text-slate-500 uppercase font-black mb-1">检查物理开关</p>
                <p className="text-[10px] text-slate-300">确保摄像头遮盖片已滑开，或按 F8 开启。</p>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-white/5">
                <p className="text-[8px] text-slate-500 uppercase font-black mb-1">检查合盖状态</p>
                <p className="text-[10px] text-slate-300">如果使用外接显示器，请确保笔记本盖子处于开启状态。</p>
              </div>
            </div>
            <button onClick={() => startMedia(activeTab as any)} className="mt-8 bg-indigo-600 text-white px-8 py-2 rounded-xl text-[10px] font-black uppercase">重新检测设备</button>
          </div>
        )}

        {recording && <button onClick={stopMedia} className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-500 text-white px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 border-b-4 border-red-800 z-50">
          停止并保存
        </button>}
      </div>
    </div>
  );
};

export default StudioView;
