
import React, { useState, useRef, useEffect } from 'react';

const StudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio'>('image');
  const [mediaBlob, setMediaBlob] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 处理图片粘贴
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

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setMediaBlob(URL.createObjectURL(blob));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (e) { alert("无法开启摄像头"); }
  };

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setMediaBlob(URL.createObjectURL(blob));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (e) { alert("无法开启麦克风"); }
  };

  const stopMedia = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setRecording(false);
  };

  const downloadMedia = () => {
    if (!mediaBlob) return;
    const a = document.createElement('a');
    a.href = mediaBlob;
    a.download = `ZenNote_${activeTab}_${Date.now()}`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-bold text-white">多媒体工坊</h2>
        <p className="text-slate-500 text-xs">录制或保存多媒体笔记到本地。</p>
      </header>

      <div className="flex bg-slate-800/40 p-1 rounded-xl w-fit">
        {['image', 'video', 'audio'].map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab as any); setMediaBlob(null); stopMedia(); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
          >
            {tab === 'image' ? '图片' : tab === 'video' ? '视频' : '语音'}
          </button>
        ))}
      </div>

      <div className="aspect-video bg-slate-950 rounded-3xl border border-white/5 flex items-center justify-center overflow-hidden relative group">
        {activeTab === 'image' && (
          mediaBlob ? (
            <img src={mediaBlob} className="max-h-full" alt="Pasted" />
          ) : (
            <div className="text-center text-slate-600">
              <p className="text-sm">点击上传或直接 <span className="text-indigo-400">Ctrl+V</span> 粘贴图片</p>
              <input type="file" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setMediaBlob(URL.createObjectURL(f));
              }} className="mt-4 text-xs" />
            </div>
          )
        )}

        {activeTab === 'video' && (
          recording ? (
            <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
          ) : (
            mediaBlob ? (
              <video src={mediaBlob} controls className="w-full h-full object-contain" />
            ) : (
              <button onClick={startVideo} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold">开启摄像头录制</button>
            )
          )
        )}

        {activeTab === 'audio' && (
          recording ? (
            <div className="flex flex-col items-center gap-4">
               <div className="w-16 h-16 bg-red-500 rounded-full animate-ping" />
               <p className="text-red-500 font-bold uppercase tracking-widest">录音中...</p>
            </div>
          ) : (
            mediaBlob ? (
              <audio src={mediaBlob} controls />
            ) : (
              <button onClick={startAudio} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold">开始录制语音</button>
            )
          )
        )}

        {recording && (
          <button onClick={stopMedia} className="absolute bottom-6 bg-red-600 text-white px-6 py-2 rounded-xl font-bold shadow-xl">停止</button>
        )}
      </div>

      {mediaBlob && !recording && (
        <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-white/5">
          <span className="text-xs text-slate-500">文件已就绪</span>
          <div className="flex gap-3">
             <button onClick={() => setMediaBlob(null)} className="text-xs text-slate-500 hover:text-white">取消</button>
             <button onClick={downloadMedia} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">下载到本地</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudioView;
