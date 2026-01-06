
import React, { useState, useRef } from 'react';
import { AspectRatio, Book } from '../types';
import * as gemini from '../services/geminiService';

interface StudioViewProps {
  onSaveToLibrary: (book: Omit<Book, 'id'>) => void;
  onSaveNote: (content: string) => void;
}

const StudioView: React.FC<StudioViewProps> = ({ onSaveToLibrary, onSaveNote }) => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio'>('image');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Supported values for Gemini API: "1:1", "3:4", "4:3", "9:16", and "16:9".
  const SUPPORTED_RATIOS: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

  const checkKeys = async () => {
    if (typeof (window as any).aistudio !== 'undefined') {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
        // Instruction: Proceed assuming selection was successful (race condition mitigation)
      }
    }
  };

  const wrapApiCall = async (fn: () => Promise<any>) => {
    try {
      await checkKeys();
      return await fn();
    } catch (error: any) {
      if (error?.message?.includes("Requested entity was not found.")) {
        // Instruction: Reset key selection state and prompt again
        if (typeof (window as any).aistudio !== 'undefined') {
          await (window as any).aistudio.openSelectKey();
        }
        return null;
      }
      throw error;
    }
  };

  const handleGenerateImage = async () => {
    setLoading(true);
    setResultUrl(null);
    setTranscription(null);
    setSaveStatus(null);
    try {
      const url = await wrapApiCall(() => gemini.generateStudyImage(prompt, aspectRatio));
      if (url) setResultUrl(url);
    } catch (error) {
      console.error("Image generation failed", error);
      alert("Image generation failed. Ensure your API key is correctly configured with a paid project.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    setLoading(true);
    setResultUrl(null);
    setTranscription(null);
    setSaveStatus(null);
    try {
      const url = await wrapApiCall(() => gemini.generateStudyVideo(prompt, aspectRatio === "9:16"));
      if (url) setResultUrl(url);
    } catch (error) {
      console.error("Video generation failed", error);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setTranscription(null);
      setSaveStatus(null);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setLoading(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            const text = await gemini.transcribeAudio(base64, 'audio/webm');
            setTranscription(text || "No speech detected.");
          } catch (error) {
            console.error("Transcription error", error);
            alert("Failed to transcribe audio.");
          } finally {
            setLoading(false);
          }
        };
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access denied", error);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
  };

  const handleEditImage = async () => {
    if (!resultUrl) return;
    setLoading(true);
    try {
      const edited = await wrapApiCall(() => gemini.editImage(resultUrl, prompt));
      if (edited) setResultUrl(edited);
    } catch (error) {
      console.error("Image editing failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToLibrary = () => {
    if (!resultUrl) return;
    
    const type = activeTab === 'video' ? 'video' : 'image';
    onSaveToLibrary({
      title: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
      contentSnippet: `Generated ${type}: ${prompt}`,
      progress: 0,
      type: type as any,
      mediaUrl: resultUrl
    });
    
    setSaveStatus("Success! Saved to Library.");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSaveTranscription = () => {
    if (!transcription) return;
    onSaveNote(transcription);
    setSaveStatus("Saved to Clippings Vault!");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Creative Studio</h2>
        <p className="text-slate-400 text-sm">Generate visual & audio aids for your studies. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline text-slate-500 hover:text-indigo-400 transition-colors">Billing Info</a></p>
      </header>

      <div className="flex bg-slate-800/40 p-1 rounded-xl w-fit">
        {(['image', 'video', 'audio'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { 
              setActiveTab(tab); 
              setResultUrl(null); 
              setTranscription(null);
              setSaveStatus(null); 
            }}
            title={`Switch to ${tab} creation mode`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="bg-slate-800/20 border border-white/5 p-6 rounded-2xl space-y-4">
        {activeTab !== 'audio' ? (
          <>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Creation Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                title="Enter a detailed description for the AI to generate or edit content"
                placeholder={activeTab === 'image' ? "A complex diagram showing photosynthesis..." : "A slow pan across a peaceful library..."}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all h-24"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Aspect Ratio</span>
                <div className="flex gap-1">
                  {SUPPORTED_RATIOS.map(r => (
                    <button
                      key={r}
                      onClick={() => setAspectRatio(r)}
                      title={`Set aspect ratio to ${r}`}
                      className={`px-3 py-1 rounded-lg border text-[10px] transition-all font-bold ${aspectRatio === r ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-white/5 text-slate-500 hover:text-slate-300'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 self-end">
                {resultUrl && activeTab === 'image' && (
                  <button onClick={handleEditImage} title="Apply prompt to edit the current image" className="text-indigo-400 text-xs font-bold hover:underline px-2">Edit with prompt</button>
                )}
                <button
                  disabled={loading || !prompt}
                  onClick={activeTab === 'image' ? handleGenerateImage : handleGenerateVideo}
                  title={`Trigger AI to generate ${activeTab}`}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2"
                >
                  {loading && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
                  {loading ? 'Generating...' : `Generate ${activeTab}`}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-10 gap-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading}
              title={isRecording ? "Stop recording study memo" : "Start recording study memo"}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 hover:scale-105'} ${loading ? 'opacity-50 grayscale' : ''}`}
            >
              {isRecording ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3-3z" />
                </svg>
              )}
            </button>
            <p className="text-slate-400 text-sm">
              {loading ? "Transcribing Audio..." : isRecording ? "Listening... click to stop" : "Record a study memo to transcribe"}
            </p>
          </div>
        )}

        {resultUrl && (
          <div className="mt-6 space-y-4 animate-in zoom-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/40">
              {activeTab === 'image' ? (
                <img src={resultUrl} className="w-full h-auto object-contain max-h-[500px]" alt="Generated Study Aid" />
              ) : (
                <video src={resultUrl} controls className="w-full h-auto max-h-[500px]" />
              )}
            </div>
            
            <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{saveStatus || "Permanent archive available"}</span>
              <button 
                onClick={handleSaveToLibrary}
                title="Save this creation to your library"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Add to Library
              </button>
            </div>
          </div>
        )}

        {transcription && (
          <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 duration-500">
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/10 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Transcription</span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{transcription}</p>
            </div>
            
            <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{saveStatus || "Permanent archive available"}</span>
              <button 
                onClick={handleSaveTranscription}
                title="Save this transcribed text as a note clipping"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Save as Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudioView;
