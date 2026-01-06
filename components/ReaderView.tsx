
import React, { useState, useRef, useEffect } from 'react';
import { Book } from '../types';
import { deepAnalysis } from '../services/geminiService';

interface ReaderViewProps {
  books: Book[];
  setBooks: (books: Book[]) => void;
}

const ReaderView: React.FC<ReaderViewProps> = ({ books, setBooks }) => {
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Interactive states
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Video Player States
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const type = file.type.includes('video') ? 'video' : file.type.includes('image') ? 'image' : 'pdf';
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const newBook: Book = {
          id: Date.now().toString(),
          title: file.name,
          contentSnippet: `Uploaded media: ${file.name}. Ask AI to analyze it.`,
          progress: 0,
          type: type as any,
          mediaUrl: event.target?.result as string
        };
        setBooks([newBook, ...books]);
        setIsUploading(false);
      };

      reader.onerror = () => {
        setIsUploading(false);
        alert("Failed to read file.");
      };

      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeMedia = async () => {
    if (!activeBook || !activeBook.mediaUrl) return;
    setIsReading(true);
    const mimeType = activeBook.type === 'image' ? 'image/png' : activeBook.type === 'video' ? 'video/mp4' : 'application/pdf';
    const base64Data = activeBook.mediaUrl.split(',')[1];
    
    const result = await deepAnalysis([
      { inlineData: { data: base64Data, mimeType } },
      { text: aiQuestion || "Analyze this content for key study information." }
    ]);
    
    setAiAnswer(result || "Analysis failed.");
    setIsReading(false);
  };

  const resetActiveBook = () => {
    setActiveBook(null);
    setAiAnswer('');
    setZoomLevel(1);
    setIsTheaterMode(false);
  };

  // Video Logic
  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.parentElement?.requestFullscreen();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  return (
    <div className={`space-y-6 relative transition-all duration-500 ${isTheaterMode ? 'max-w-none' : ''}`}>
      {isUploading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-2xl animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-white font-medium animate-pulse">Processing your file...</p>
          </div>
        </div>
      )}

      {!activeBook ? (
        <>
          <header className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Library</h2>
              <p className="text-slate-400 text-sm">PDFs, Images, and Videos.</p>
            </div>
            <label className={`cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg flex items-center gap-2 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Import Media
              <input type="file" className="hidden" accept=".pdf,.txt,.mp4,.png,.jpg,.jpeg" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </header>

          <div className="grid grid-cols-1 gap-4">
            {books.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl">
                <p className="text-slate-500">No media yet. Upload a PDF, Image or Video.</p>
              </div>
            ) : (
              books.map(book => (
                <div key={book.id} onClick={() => !isUploading && setActiveBook(book)} className={`bg-slate-800/30 border border-white/5 p-5 rounded-2xl hover:bg-slate-800/60 transition-all flex items-center gap-5 group ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <div className="w-12 h-16 bg-slate-700 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-indigo-600/20 group-hover:text-indigo-400 transition-colors shadow-inner">
                    {book.type === 'video' ? '🎥' : book.type === 'image' ? '🖼️' : '📄'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-200 group-hover:text-white transition-colors">{book.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">{book.type}</p>
                  </div>
                  <div className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="animate-in slide-in-from-right duration-500 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <button onClick={resetActiveBook} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm font-medium transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to Library
            </button>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsTheaterMode(!isTheaterMode)} 
                className={`p-2 rounded-lg text-xs font-bold transition-all ${isTheaterMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                title="Toggle Theater Mode"
              >
                {isTheaterMode ? 'Exit Theater' : 'Theater Mode'}
              </button>
            </div>
          </div>
          
          <div className={`bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 ${isTheaterMode ? 'flex-1' : 'min-h-[500px]'} flex flex-col`}>
            {/* Toolbar for the active media */}
            <div className="bg-slate-800/50 p-3 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-200 truncate px-2">{activeBook.title}</h2>
              <div className="flex items-center gap-3">
                {activeBook.type === 'image' && (
                  <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-white/5">
                    <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))} className="p-1 text-slate-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></button>
                    <span className="text-[10px] text-slate-500 w-10 text-center font-mono">{Math.round(zoomLevel * 100)}%</span>
                    <button onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))} className="p-1 text-slate-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
                  </div>
                )}
              </div>
            </div>

            {/* Media Canvas */}
            <div className="flex-1 relative overflow-auto bg-black/40 flex items-center justify-center p-4 min-h-[300px]">
              {activeBook.type === 'image' && (
                <div className="transition-transform duration-200 ease-out origin-center" style={{ transform: `scale(${zoomLevel})` }}>
                  <img src={activeBook.mediaUrl} className="max-w-full h-auto rounded-sm shadow-2xl" alt={activeBook.title} />
                </div>
              )}
              {activeBook.type === 'video' && (
                <div 
                  className="w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative group/player"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => isPlaying && setShowControls(false)}
                >
                  <video 
                    ref={videoRef}
                    src={activeBook.mediaUrl} 
                    className="w-full h-full cursor-pointer"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onClick={togglePlay}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
                  {/* Central Overlay Button */}
                  {(!isPlaying || showControls) && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 pointer-events-none"
                      onClick={togglePlay}
                    >
                      <button 
                        className="w-16 h-16 bg-indigo-600/80 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95 pointer-events-auto"
                      >
                        {isPlaying ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 ml-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Bottom Controls Bar */}
                  <div 
                    className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {/* Seek Bar */}
                    <div className="flex items-center gap-3 mb-2">
                      <input 
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 accent-indigo-500 h-1 rounded-lg bg-white/20 appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between text-white text-xs font-medium">
                      <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="hover:text-indigo-400 transition-colors">
                          {isPlaying ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                          )}
                        </button>
                        
                        <div className="flex items-center gap-2">
                          <button onClick={toggleMute} className="hover:text-indigo-400 transition-colors">
                            {isMuted || volume === 0 ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 14.657a1 1 0 01-1.414-1.414A3.998 3.998 0 0015 10c0-1.104-.448-2.104-1.172-2.828a1 1 0 111.414-1.414A5.998 5.998 0 0117 10c0 1.657-.672 3.157-1.757 4.243z" clipRule="evenodd" /><path fillRule="evenodd" d="M12.728 12.728a1 1 0 01-1.414-1.414A1.998 1.998 0 0012 10c0-.552-.224-1.052-.586-1.414a1 1 0 011.414-1.414A3.998 3.998 0 0114 10c0 1.104-.448 2.104-1.272 2.728z" clipRule="evenodd" /></svg>
                            )}
                          </button>
                          <input 
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="w-16 accent-indigo-500 h-1 rounded-lg bg-white/20 appearance-none cursor-pointer"
                          />
                        </div>

                        <span className="font-mono text-[10px] tracking-widest text-slate-300">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      <button onClick={toggleFullscreen} className="hover:text-indigo-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {activeBook.type === 'pdf' && (
                <div className="w-full max-w-3xl h-full flex flex-col items-center justify-center text-center p-10 bg-slate-800/20 border border-white/5 rounded-xl border-dashed">
                  <div className="w-24 h-32 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center mb-6 shadow-2xl relative">
                    <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded flex items-center justify-center text-[10px] font-bold text-white">PDF</div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Document Preview</h3>
                  <p className="text-slate-400 text-sm max-w-xs mb-6">PDF interactive viewing is optimized for AI analysis. Use the sidebar tool to extract data.</p>
                  <button className="px-6 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm hover:bg-slate-700 transition-all border border-white/5">Open Externally</button>
                </div>
              )}
            </div>

            {/* AI Interaction Section */}
            {!isTheaterMode && (
              <div className="bg-slate-900/90 p-6 border-t border-white/10">
                <div className="bg-slate-950/50 rounded-2xl p-5 border border-white/5 shadow-inner">
                  <h4 className="text-xs font-bold text-indigo-400 mb-4 uppercase flex items-center gap-2 tracking-widest">
                    <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    Gemini Intelligence
                  </h4>
                  <div className="space-y-4">
                    {aiAnswer && (
                      <div className="text-sm text-slate-300 bg-slate-800/80 rounded-xl p-4 border border-indigo-500/20 whitespace-pre-wrap leading-relaxed shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {aiAnswer}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <input 
                        value={aiQuestion} 
                        onChange={(e) => setAiQuestion(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeMedia()}
                        placeholder="Ask about this material (e.g., Summarize the main points)" 
                        className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" 
                      />
                      <button 
                        onClick={handleAnalyzeMedia} 
                        disabled={isReading} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg flex items-center gap-2"
                      >
                        {isReading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            Thinking
                          </>
                        ) : 'Ask AI'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReaderView;
