
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

const StudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio' | 'veo'>('image');
  const [mediaBlob, setMediaBlob] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // 播放器状态
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Veo Video Generation States
  const [veoPrompt, setVeoPrompt] = useState('');
  const [veoRatio, setVeoRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isVeoGenerating, setIsVeoGenerating] = useState(false);
  const [veoProgress, setVeoProgress] = useState('');

  // 设备枚举
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // 音频频谱相关
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);

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
    return () => {
      releaseHardware();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
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
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
  };

  const startVisualizer = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyzer = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyzer);
      analyzer.fftSize = 64;
      
      audioCtxRef.current = audioCtx;
      analyzerRef.current = analyzer;

      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const draw = () => {
        if (!recording) return;
        animationFrameRef.current = requestAnimationFrame(draw);
        analyzer.getByteFrequencyData(dataArray);
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = `rgba(99, 102, 241, ${dataArray[i] / 255 + 0.2})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 4;
        }
      };
      draw();
    } catch (e) {
      console.error("Visualizer error", e);
    }
  };

  const startMedia = async (type: 'video' | 'audio') => {
    setIsInitializing(true);
    setErrorMsg(null);
    setMediaBlob(null);
    chunksRef.current = [];
    releaseHardware();

    try {
      const constraints: MediaStreamConstraints = type === 'video' 
        ? { video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (type === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(console.error);
      }

      setRecording(true);
      startVisualizer(stream);

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: type === 'video' ? 'video/webm' : 'audio/webm' });
        setMediaBlob(URL.createObjectURL(finalBlob));
      };

      recorderRef.current = recorder;
      recorder.start(500);
    } catch (err: any) {
      setErrorMsg("无法访问媒体设备，请检查权限设置。");
      setRecording(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopMedia = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
    releaseHardware();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const togglePlay = () => {
    if (!playbackRef.current) return;
    if (isPlaying) {
      playbackRef.current.pause();
    } else {
      playbackRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (playbackRef.current) {
      setCurrentTime(playbackRef.current.currentTime);
      setDuration(playbackRef.current.duration || 0);
    }
  };

  const changeSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.5];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(next);
    if (playbackRef.current) {
      playbackRef.current.playbackRate = next;
    }
  };

  const jump = (delta: number) => {
    if (playbackRef.current) {
      playbackRef.current.currentTime = Math.max(0, Math.min(duration, playbackRef.current.currentTime + delta));
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      <header className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            多媒体工坊 {recording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </h2>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Media & Review Pro</p>
        </div>
        {!recording && activeTab === 'video' && videoDevices.length > 1 && (
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

      <div className="flex bg-slate-800/40 p-1 rounded-2xl w-fit border border-white/5 shrink-0">
        {(['image', 'video', 'audio', 'veo'] as const).map((tab) => (
          <button
            key={tab}
            disabled={recording || isVeoGenerating}
            onClick={() => { setActiveTab(tab); setMediaBlob(null); setErrorMsg(null); releaseHardware(); }}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30'}`}
          >
            {/* Fix: changed '录制音频' comparison to 'audio' which matches the literal type. */}
            {tab === 'image' ? '图片' : tab === 'video' ? '录制视频' : tab === 'audio' ? '录音' : 'AI 创作'}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 bg-slate-950 rounded-[32px] border border-white/5 relative overflow-hidden flex flex-col items-center justify-center">
        {/* 预览/采集层 */}
        {activeTab === 'video' && (
          <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover mirror ${recording ? 'block' : 'hidden'}`} />
        )}
        
        {recording && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 z-10">
            <canvas ref={canvasRef} width={300} height={100} className="w-64 h-20" />
            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.4em] mt-4 animate-pulse">正在捕捉高保真采样...</p>
            <button onClick={stopMedia} className="mt-8 bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 border-b-4 border-red-800">
              完成录制
            </button>
          </div>
        )}

        {/* 播放/回看层 */}
        {mediaBlob && !recording && (
          <div className="relative w-full h-full group flex flex-col items-center justify-center">
            {activeTab === 'video' || activeTab === 'veo' ? (
              <video 
                ref={el => { (playbackRef.current as any) = el; }} 
                src={mediaBlob} 
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
              />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <audio ref={el => { (playbackRef.current as any) = el; }} src={mediaBlob} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleTimeUpdate} onEnded={() => setIsPlaying(false)} className="hidden" />
                <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center text-4xl animate-pulse">🎙️</div>
                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">录音回看模式</p>
              </div>
            )}

            {/* 自定义增强控件面板 */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-slate-900/90 backdrop-blur-2xl border border-white/10 p-4 rounded-[28px] flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20">
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono text-slate-500 w-8">{Math.floor(currentTime)}s</span>
                <input 
                  type="range" min="0" max={duration || 0} step="0.1" value={currentTime} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (playbackRef.current) playbackRef.current.currentTime = val;
                    setCurrentTime(val);
                  }}
                  className="flex-1 accent-indigo-500 h-1.5 rounded-full cursor-pointer bg-slate-800"
                />
                <span className="text-[9px] font-mono text-slate-500 w-8">{Math.floor(duration)}s</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => jump(-5)} className="text-slate-400 hover:text-white text-xs">⏪ 5s</button>
                  <button onClick={togglePlay} className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm shadow-lg shadow-indigo-500/20">
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => jump(5)} className="text-slate-400 hover:text-white text-xs">5s ⏩</button>
                </div>
                <button onClick={changeSpeed} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter">
                  {playbackSpeed}x Speed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 初始状态/空状态 */}
        {!recording && !mediaBlob && !isInitializing && !errorMsg && (
          <div className="text-center p-8">
            <div className="w-20 h-20 bg-slate-900 rounded-[28px] mx-auto mb-6 flex items-center justify-center text-3xl shadow-inner">
              {activeTab === 'image' ? '🖼️' : activeTab === 'video' ? '📹' : activeTab === 'audio' ? '🎙️' : '✨'}
            </div>
            <button 
              onClick={() => activeTab !== 'image' && activeTab !== 'veo' && startMedia(activeTab as any)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95"
            >
              {activeTab === 'video' ? '开启录制' : activeTab === 'audio' ? '开始录音' : '等待内容...'}
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-10 text-center">
            <p className="text-red-400 text-xs font-bold mb-4">{errorMsg}</p>
            <button onClick={() => window.location.reload()} className="text-[10px] text-indigo-400 underline font-black uppercase">尝试刷新页面</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudioView;
