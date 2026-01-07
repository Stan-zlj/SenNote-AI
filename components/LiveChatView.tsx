
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, encode } from '../services/geminiService';

const LiveChatView: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('点击开始实时语音对话');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopLive = () => {
    if (sessionRef.current) sessionRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setIsActive(false);
    setStatus('点击开始实时语音对话');
  };

  const startLive = async () => {
    try {
      setStatus('连接中...');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setStatus('正在倾听...');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => console.error("Live Error", e),
          onclose: () => stopLive(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: 'You are a friendly real-time tutor. Respond naturally in voice.',
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (e) {
      console.error(e);
      setStatus('启动失败，请检查麦克风权限');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-12">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-2">实时语音交互</h2>
        <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Live Conversational AI</p>
      </div>

      <div className={`w-64 h-64 rounded-full flex items-center justify-center relative transition-all duration-700 ${isActive ? 'bg-indigo-600/20 scale-110' : 'bg-slate-800'}`}>
        {isActive && (
          <>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 animate-ping opacity-20" />
            <div className="absolute inset-4 rounded-full border-2 border-indigo-400 animate-pulse opacity-40" />
            <div className="flex gap-1 items-end h-16">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className="w-2 bg-indigo-500 rounded-full animate-[bounce_1s_infinite]" style={{ height: `${Math.random()*100}%`, animationDelay: `${i*0.1}s` }} />
               ))}
            </div>
          </>
        )}
        {!isActive && <span className="text-6xl">🎙️</span>}
      </div>

      <div className="text-center space-y-6">
        <p className={`text-sm font-medium ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>{status}</p>
        <button
          onClick={isActive ? stopLive : startLive}
          className={`px-12 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${isActive ? 'bg-red-500 hover:bg-red-400' : 'bg-indigo-600 hover:bg-indigo-500'} text-white`}
        >
          {isActive ? '结束通话' : '开始对话'}
        </button>
      </div>
    </div>
  );
};

export default LiveChatView;
