
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

const StudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio' | 'veo'>('image');
  const [mediaBlob, setMediaBlob] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [veoPrompt, setVeoPrompt] = useState('');
  const [veoRatio, setVeoRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isVeoGenerating, setIsVeoGenerating] = useState(false);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
    });
    return () => releaseHardware();
  }, []);

  const releaseHardware = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const startVisualizer = (stream: MediaStream) => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyzer = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyzer);
    analyzer.fftSize = 64;
    audioCtxRef.current = audioCtx;
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / dataArray.length) * 2;
      dataArray.forEach((v, i) => {
        const barHeight = (v / 255) * canvas.height;
        ctx.fillStyle = `rgba(99, 102, 241, ${v/255 + 0.3})`;
        ctx.fillRect(i * (barWidth + 2), canvas.height - barHeight, barWidth, barHeight);
      });
    };
    draw();
  };

  const startMedia = async (type: 'video' | 'audio') => {
    setIsInitializing(true);
    setMediaBlob(null);
    chunksRef.current = [];
    try {
      const constraints = type === 'video' ? { video: selectedVideoId ? { deviceId: selectedVideoId } : true, audio: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (type === 'video' && videoRef.current) videoRef.current.srcObject = stream;
      startVisualizer(stream);
      const recorder = new MediaRecorder(stream);
      // Store recorder in ref so it can be accessed for stopping
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => setMediaBlob(URL.createObjectURL(new Blob(chunksRef.current, { type: type === 'video' ? 'video/webm' : 'audio/webm' })));
      recorder.start();
      setRecording(true);
    } catch (e) { setErrorMsg("设备启动失败"); }
    finally { setIsInitializing(false); }
  };

  const stopMedia = () => {
    if (recorderRef.current) recorderRef.current.stop();
    setRecording(false);
    releaseHardware();
  };

  const togglePlay = () => {
    if (!playbackRef.current) return;
    if (isPlaying) playbackRef.current.pause(); else playbackRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (playbackRef.current) {
      setCurrentTime(playbackRef.current.currentTime);
      setDuration(playbackRef.current.duration || 0);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      <header className="shrink-0 flex justify-between items-center">
        <h2 className="text-xl font-black text-white">多媒体工坊</h2>
        <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5">
          {(['image', 'video', 'audio', 'veo'] as const).map(tab => (
            <button key={tab} onClick={() => {setActiveTab(tab); setMediaBlob(null);}} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
              {tab === 'image' ? '图' : tab === 'video' ? '视' : tab === 'audio' ? '音' : 'AI'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 bg-slate-950 rounded-[32px] border border-white/5 relative overflow-hidden flex flex-col items-center justify-center">
        {recording ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 z-20">
            {activeTab === 'video' && <video ref={videoRef} autoPlay muted className="absolute inset-0 w-full h-full object-cover mirror opacity-40" />}
            <canvas ref={canvasRef} width={200} height={60} className="w-48 h-12 relative z-30" />
            <button onClick={stopMedia} className="mt-6 bg-red-600 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest relative z-30">停止</button>
          </div>
        ) : mediaBlob ? (
          <div className="relative w-full h-full group flex flex-col items-center justify-center">
            {activeTab === 'video' || activeTab === 'veo' ? (
              // Use bracketed assignment to avoid returning the element to satisfy React Ref types
              <video ref={el => { playbackRef.current = el; }} src={mediaBlob} className="w-full h-full object-contain" onTimeUpdate={handleTimeUpdate} />
            ) : (
              <div className="flex flex-col items-center gap-4">
                // Use bracketed assignment to avoid returning the element to satisfy React Ref types
                <audio ref={el => { playbackRef.current = el; }} src={mediaBlob} onTimeUpdate={handleTimeUpdate} className="hidden" />
                <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center text-3xl animate-pulse">🎙️</div>
              </div>
            )}
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-slate-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-[24px] opacity-0 group-hover:opacity-100 transition-all z-50">
              <input type="range" min="0" max={duration} step="0.1" value={currentTime} onChange={e => { if(playbackRef.current) playbackRef.current.currentTime = parseFloat(e.target.value); }} className="w-full accent-indigo-500 h-1 mb-3" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => { if(playbackRef.current) playbackRef.current.currentTime -= 5; }} className="text-xs text-slate-400 hover:text-white">⏪ 5s</button>
                  <button onClick={togglePlay} className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">{isPlaying ? '⏸' : '▶'}</button>
                  <button onClick={() => { if(playbackRef.current) playbackRef.current.currentTime += 5; }} className="text-xs text-slate-400 hover:text-white">5s ⏩</button>
                </div>
                <button onClick={() => { const s = [1, 1.5, 2, 0.5]; const next = s[(s.indexOf(playbackSpeed) + 1) % s.length]; setPlaybackSpeed(next); if(playbackRef.current) playbackRef.current.playbackRate = next; }} className="text-[10px] font-bold bg-slate-800 px-3 py-1 rounded-lg">
                  {playbackSpeed}x 速度
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-8">
            <button onClick={() => startMedia(activeTab as any)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl transition-all">
              开始采集
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudioView;
