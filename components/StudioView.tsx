
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
    if (audioCtxRef.current) audioCtxRef.current.close();
  };

  const startVisualizer = (stream: MediaStream) => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyzer = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyzer);
    analyzer.fftSize = 64;
    
    audioCtxRef.current = audioCtx;
    analyzerRef.current = analyzer;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#4f46e5');
        gradient.addColorStop(1, '#818cf8');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
      }
    };
    draw();
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

      startVisualizer(stream);

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
      setErrorMsg("设备启动失败，请检查麦克风/摄像头权限。");
      releaseHardware();
    } finally {
      setIsInitializing(false);
    }
  };

  const stopMedia = () => {
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    setRecording(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  // 播放器逻辑
  const togglePlay = () => {
    if (!playbackRef.current) return;
    if (isPlaying) playbackRef.current.pause();
    else playbackRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (playbackRef.current) {
      setCurrentTime(playbackRef.current.currentTime);
      setDuration(playbackRef.current.duration);
    }
  };

  const seek = (val: number) => {
    if (playbackRef.current) {
      playbackRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const jump = (delta: number) => {
    if (playbackRef.current) {
      playbackRef.current.currentTime = Math.min(Math.max(0, playbackRef.current.currentTime + delta), duration);
    }
  };

  const changeSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.5];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(next);
    if (playbackRef.current) playbackRef.current.playbackRate = next;
  };

  // Veo Generation
  const generateVeoVideo = async () => {
    if (!veoPrompt.trim()) return;
    setIsVeoGenerating(true);
    setVeoProgress("正在联系智影创作中心 (Veo 3)...");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: veoPrompt,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: veoRatio }
      });
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        setVeoProgress("AI 正在精心渲染您的创意视频...");
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const videoRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const videoBlob = await videoRes.blob();
        setMediaBlob(URL.createObjectURL(videoBlob));
      }
    } catch (err: any) {
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
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Media Lab & Player Pro</p>
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
                placeholder="描述你想要的视频场景..."
                className="w-full h-20 bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => setVeoRatio('16:9')} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${veoRatio === '16:9' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 text-slate-500'}`}>16:9</button>
                  <button onClick={() => setVeoRatio('9:16')} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${veoRatio === '9:16' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/10 text-slate-500'}`}>9:16</button>
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
                <div className="relative w-full h-full group">
                  <video 
                    ref={el => { (playbackRef.current as any) = el; }} 
                    src={mediaBlob} 
                    className="w-full h-full object-contain"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleTimeUpdate}
                  />
                  {/* 自定义控件 */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-[24px] flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all shadow-2xl z-50">
                    <input 
                      type="range" min="0" max={duration || 0} step="0.1" value={currentTime} 
                      onChange={(e) => seek(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded-full cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                      <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-white bg-indigo-600 w-8 h-8 rounded-full flex items-center justify-center">{isPlaying ? '⏸' : '▶'}</button>
                        <button onClick={() => jump(-5)}>⏪ -5s</button>
                        <button onClick={() => jump(5)}>+5s ⏩</button>
                        <button onClick={changeSpeed} className="bg-slate-800 px-3 py-1 rounded-lg">速度: {playbackSpeed}x</button>
                      </div>
                      <div className="tabular-nums">
                        {Math.floor(currentTime)}s / {Math.floor(duration)}s
                      </div>
                    </div>
                  </div>
                </div>
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
          <div className="aspect-video bg-slate-950 rounded-[32px] border border-white/5 flex flex-col items-center justify-center overflow-hidden relative shadow-inner h-full max-h-[400px]">
            <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover mirror ${activeTab === 'video' && recording ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
            
            {/* 录音可视化 - 麦克风阵列效果 */}
            {recording && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 pointer-events-none z-10">
                <canvas ref={canvasRef} width={200} height={60} className="w-48 h-16 opacity-80" />
                <p className="text-[10px] text-red-400 font-black uppercase tracking-[0.3em] mt-4 animate-pulse">正在捕捉采样中...</p>
              </div>
            )}

            {mediaBlob && (activeTab === 'video' || activeTab === 'audio') && !recording && (
               <div className="relative w-full h-full group flex flex-col items-center justify-center z-20">
                  {activeTab === 'video' ? (
                    <video ref={el => { (playbackRef.current as any) = el; }} src={mediaBlob} className="w-full h-full object-contain" onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleTimeUpdate} />
                  ) : (
                    <div className="flex flex-col items-center gap-6">
                      <audio ref={el => { (playbackRef.current as any) = el; }} src={mediaBlob} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleTimeUpdate} className="hidden" />
                      <div className="w-24 h-24 bg-indigo-600/20 rounded-full flex items-center justify-center text-4xl animate-pulse">🎙️</div>
                      <p className="text-xs text-indigo-400 font-black uppercase tracking-widest">音频已录制完毕</p>
                    </div>
                  )}

                  {/* 自定义播放控件 */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-[24px] flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all shadow-2xl z-50">
                    <input 
                      type="range" min="0" max={duration || 0} step="0.1" value={currentTime} 
                      onChange={(e) => seek(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 rounded-full cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                      <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-white bg-indigo-600 w-8 h-8 rounded-full flex items-center justify-center">{isPlaying ? '⏸' : '▶'}</button>
                        <button onClick={() => jump(-5)}>⏪ -5s</button>
                        <button onClick={() => jump(5)}>+5s ⏩</button>
                        <button onClick={changeSpeed} className="bg-slate-800 px-3 py-1 rounded-lg">速度: {playbackSpeed}x</button>
                      </div>
                      <div className="tabular-nums">{Math.floor(currentTime)}s / {Math.floor(duration)}s</div>
                    </div>
                  </div>
               </div>
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
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">正在初始化传感器...</p>
            </div>}

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
