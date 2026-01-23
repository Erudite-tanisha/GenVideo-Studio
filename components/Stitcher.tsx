import React, { useState, useRef, useEffect } from 'react';
import { VideoClip, AudioClip } from '../types';
import { Play, Pause, ArrowUp, ArrowDown, Trash2, Film, Check, Music, Wand2, SkipForward, SkipBack, Sparkles, Upload, Loader2, Merge } from 'lucide-react';
import { Button } from './Button';
import { generateLipSync } from '../services/falService';

interface StitcherProps {
  clips: VideoClip[];
  audioClips?: AudioClip[];
  onVideoGenerated: (video: VideoClip) => void;
}

export const Stitcher: React.FC<StitcherProps> = ({ clips: initialClips, audioClips = [], onVideoGenerated }) => {
  const [playlist, setPlaylist] = useState<VideoClip[]>(initialClips);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isStitching, setIsStitching] = useState(false);
  const [stitchProgress, setStitchProgress] = useState(0);

  const [syncVideoId, setSyncVideoId] = useState<string>('');
  const [syncAudioId, setSyncAudioId] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync prop changes if new clips are added externally, but maintain order if possible
  useEffect(() => {
    const existingIds = new Set(playlist.map(c => c.id));
    const newClips = initialClips.filter(c => !existingIds.has(c.id));
    if (newClips.length > 0) {
      setPlaylist(prev => [...prev, ...newClips]);
    }
  }, [initialClips]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newPlaylist = [...playlist];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < newPlaylist.length) {
      [newPlaylist[index], newPlaylist[targetIndex]] = [newPlaylist[targetIndex], newPlaylist[index]];
      setPlaylist(newPlaylist);
    }
  };

  const removeItem = (id: string) => {
    setPlaylist(prev => prev.filter(item => item.id !== id));
    if (currentPlayingIndex !== null && playlist[currentPlayingIndex]?.id === id) {
      stopSequence();
    }
  };

  const startSequence = () => {
    if (playlist.length === 0) return;
    setIsPreviewMode(false); 
    setCurrentPlayingIndex(0);
    setIsPlaying(true);
  };
  

  const stopSequence = () => {
    setIsPlaying(false);
    setCurrentPlayingIndex(null);
    setCurrentTime(0);
    setDuration(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        if (selectedAudioId && audioRef.current) audioRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
      }
    } else if (playlist.length > 0 && currentPlayingIndex === null) {
      startSequence();
    }
  };

  // Handle source change when index changes
  useEffect(() => {
    if (currentPlayingIndex !== null && videoRef.current) {
      const clip = playlist[currentPlayingIndex];
      if (!clip || !clip.url) {
        console.warn("Invalid clip at index", currentPlayingIndex, playlist);
        return;
      }
      videoRef.current.src = clip.url;
      videoRef.current.load();

      setCurrentTime(0); 
      
      if (!isPreviewMode) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(e => {
              console.error("Autoplay failed", e);
              setIsPlaying(false);
            });
        }
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      

      // Handle Audio for the sequence start
      if (currentPlayingIndex === 0 && selectedAudioId && audioRef.current) {
        const audioClip = audioClips.find(a => a.id === selectedAudioId);
        if (audioClip) {
          audioRef.current.src = audioClip.url;
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.error(e));
        }
      }
    }
  }, [currentPlayingIndex, playlist]); 

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoLoadedMetadata = () => {
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

  const handleVideoEnded = () => {
    if (currentPlayingIndex !== null && currentPlayingIndex < playlist.length - 1) {
      setCurrentPlayingIndex(prev => (prev !== null ? prev + 1 : null));
    } else {
      // Sequence Finished
      setIsPlaying(false);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const newClip: VideoClip = {
      id: crypto.randomUUID(),
      url,
      prompt: `Uploaded: ${file.name}`,
      type: 'upload',
      createdAt: Date.now()
    };
    
    onVideoGenerated(newClip);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getFirstClipDimensions = async (url: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = "anonymous";
      video.src = url;
      video.onloadedmetadata = () => {
        // Ensure even dimensions for encoding compatibility
        const width = video.videoWidth % 2 === 0 ? video.videoWidth : video.videoWidth - 1;
        const height = video.videoHeight % 2 === 0 ? video.videoHeight : video.videoHeight - 1;
        resolve({ width, height });
        video.remove();
      };
      video.onerror = (e) => reject(e);
    });
  };

  const handleStitch = async () => {
    if (playlist.length === 0) return;
    setIsStitching(true);
    setStitchProgress(0);
    stopSequence(); // Stop any current playback
  
    try {
      // Force canvas to 9:16 (1080x1920)
      const CANVAS_WIDTH = 1080;
      const CANVAS_HEIGHT = 1920;
  
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
  
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error("Could not get canvas context");
  
      // Black background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
      // Setup Recorder
      const stream = canvas.captureStream(30);
  
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm; codecs=vp9',
        videoBitsPerSecond: 25000000
      });
  
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
  
      mediaRecorder.start();
  
      const tempVideo = document.createElement('video');
      tempVideo.crossOrigin = "anonymous";
      tempVideo.muted = true;
  
      for (let i = 0; i < playlist.length; i++) {
        const clip = playlist[i];
        setStitchProgress(Math.round((i / playlist.length) * 100));
  
        await new Promise<void>((resolve, reject) => {
          tempVideo.src = clip.url;
  
          tempVideo.onloadeddata = async () => {
            try {
              await tempVideo.play();
  
              const draw = () => {
                if (tempVideo.paused || tempVideo.ended) return;
  
                const vW = tempVideo.videoWidth;
                const vH = tempVideo.videoHeight;
  
                const vRatio = vW / vH;
                const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
  
                let drawW, drawH, offsetX, offsetY;
  
                if (vRatio > canvasRatio) {
                  // Video wider than 9:16 canvas
                  drawW = CANVAS_WIDTH;
                  drawH = CANVAS_WIDTH / vRatio;
                  offsetX = 0;
                  offsetY = (CANVAS_HEIGHT - drawH) / 2;
                } else {
                  // Video taller
                  drawH = CANVAS_HEIGHT;
                  drawW = CANVAS_HEIGHT * vRatio;
                  offsetX = (CANVAS_WIDTH - drawW) / 2;
                  offsetY = 0;
                }
  
                // Clear to black bars
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
                // Draw video centered
                ctx.drawImage(tempVideo, offsetX, offsetY, drawW, drawH);
  
                requestAnimationFrame(draw);
              };
  
              draw();
            } catch (e) {
              console.error("Stitch Playback Error", e);
              reject(e);
            }
          };
  
          tempVideo.onended = () => resolve();
          tempVideo.onerror = (e) => reject(e);
        });
      }
  
      // Finish recording
      mediaRecorder.stop();
      setStitchProgress(100);
  
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
      });
  
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
  
      const stitchedClip: VideoClip = {
        id: crypto.randomUUID(),
        url: url,
        prompt: `Stitched Clip (${playlist.length} parts)`,
        type: 'upload',
        createdAt: Date.now()
      };
  
      onVideoGenerated(stitchedClip);
  
    } catch (error) {
      console.error("Stitching Failed:", error);
      alert("Failed to stitch videos. Ensure all clips are valid.");
    } finally {
      setIsStitching(false);
      const tempVideo = document.querySelector('video[src=""]');
      if (tempVideo) tempVideo.remove();
    }
  };
  
  const handleLipSync = async () => {
    if (!syncVideoId || !syncAudioId) {
      setSyncError("Please select both a video and an audio clip.");
      return;
    }
    
    setIsSyncing(true);
    setSyncError(null);

    const videoClip = playlist.find(c => c.id === syncVideoId) || initialClips.find(c => c.id === syncVideoId);
    const audioClip = audioClips.find(a => a.id === syncAudioId);

    if (!videoClip || !audioClip) {
      setSyncError("Invalid clip selection.");
      setIsSyncing(false);
      return;
    }

    try {
      const syncedUrl = await generateLipSync(videoClip.url, audioClip.url);
      
      const newClip: VideoClip = {
        id: crypto.randomUUID(),
        url: syncedUrl,
        prompt: `Lip Sync: ${videoClip.prompt.substring(0, 30)}... + ${audioClip.voiceName}`,
        type: 'subject',
        duration: videoClip.duration,
        createdAt: Date.now()
      };

      onVideoGenerated(newClip);
      setSyncVideoId('');
      setSyncAudioId('');
      
    } catch (error: any) {
      console.error(error);
      setSyncError(error.message || "Lip sync failed. Check API Key in environment.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    const currentSrc = videoRef.current?.src;
    if (!currentSrc) {
      alert("No video loaded to export. Please select a clip from the sequence or stitch your clips.");
      return;
    }
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = currentSrc;
    // Attempt to keep extension if present in url, else default to mp4. 
    // Stitched clips are usually webm from MediaRecorder.
    const extension = currentSrc.includes('blob:') ? 'webm' : 'mp4';
    a.download = `genvideo_export_${Date.now()}.${extension}`;
   
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  };

  const getClipTypeLabel = (type: VideoClip['type']) => {
    switch(type) {
      case 'subject': return '👤 Subject';
      case 'upload': return '📁 Upload';
      default: return '📹 Stock';
    }
  };

  return (
    <div className="w-full max-w-[1600px] px-6 mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-140px)]">
      {/* Column 1: Playlist Editor */}
      <div className="lg:col-span-3 flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-bold text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-purple-400" />
                Clip Sequence
              </h2>
              <p className="text-xs text-slate-500 mt-1">Use arrows to reorder.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors border border-slate-700"
                title="Upload Video from Computer"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="video/*" 
                onChange={handleFileUpload} 
              />
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
             <label className="text-xs font-semibold text-slate-400 flex items-center gap-2 mb-2">
               <Music className="w-3 h-3" />
               Background Audio
             </label>
             <select 
               value={selectedAudioId} 
               onChange={(e) => setSelectedAudioId(e.target.value)}
               className="w-full bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
             >
               <option value="">No Audio</option>
               {audioClips.map(clip => (
                 <option key={clip.id} value={clip.id}>
                   {clip.voiceName}: {clip.text.substring(0, 20)}...
                 </option>
               ))}
             </select>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {playlist.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              No clips generated yet. <br />
              Generate clips or upload a video.
            </div>
          ) : (
            playlist.map((clip, index) => (
              <div 
              key={`playlist-${clip.id}`}
              onClick={() => {
                setIsPreviewMode(true);
                setCurrentPlayingIndex(index);
              }}
              className={`flex gap-3 bg-slate-800 p-2 rounded-lg border cursor-pointer
                ${currentPlayingIndex === index ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-slate-700'}`}
              >
                <div className="w-20 h-14 bg-black rounded overflow-hidden flex-shrink-0 relative">

                  <video src={clip.url} crossOrigin="anonymous" className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1 rounded">
                    #{index + 1}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <p className="text-[10px] text-slate-300 line-clamp-2" title={clip.prompt}>
                    {clip.prompt}
                  </p>
                  
                  <div className="flex justify-end gap-1 mt-1">
                    <button 
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === playlist.length - 1}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => removeItem(clip.id)}
                      className="p-1 hover:bg-red-900/50 text-red-400 rounded ml-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 grid grid-cols-2 gap-2">
          <Button 
            className="w-full text-xs" 
            variant="secondary"
            onClick={startSequence}
            disabled={playlist.length === 0 || (currentPlayingIndex !== null && isPlaying) || isStitching}
          >
            <Play className="w-3 h-3 mr-1" />
            Play Seq.
          </Button>
          <Button 
             className="w-full text-xs"
             variant="primary"
             onClick={handleStitch}
             disabled={playlist.length === 0 || isStitching}
          >
            {isStitching ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Merge className="w-3 h-3 mr-1" />
            )}
            {isStitching ? 'Wait...' : 'Stitch Clips'}
          </Button>
        </div>
      </div>

      {/* Column 2: Lip Sync Tool */}
      <div className="lg:col-span-4 bg-slate-900/50 rounded-xl border-2 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)] p-5 flex flex-col overflow-y-auto relative">
        <div className="absolute top-0 left-0 w-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-80"></div>
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-white flex items-center gap-2 text-lg">
            <Wand2 className="w-6 h-6 text-blue-400" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
              Lip Sync Studio
            </span>
          </h2>
        </div>
        
        <div className="bg-blue-950/20 rounded-lg p-3 mb-6 border border-blue-900/30">
          <p className="text-xs text-blue-100/80 leading-relaxed flex gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            Select a video clip and a voice clip. AI will animate the character's mouth to match the speech perfectly.
          </p>
        </div>

        <div className="space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-blue-400 border border-slate-700">1</span>
              Select Video Clip
            </label>
            <select 
              value={syncVideoId} 
              onChange={(e) => setSyncVideoId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all hover:bg-slate-750"
            >
              <option value="">-- Choose Video Source --</option>
              {playlist.map(clip => (
                <option key={clip.id} value={clip.id}>
                  {getClipTypeLabel(clip.type)} - {clip.prompt.substring(0, 35)}...
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-purple-400 border border-slate-700">2</span>
              Select Audio Track
            </label>
            <select 
              value={syncAudioId} 
              onChange={(e) => setSyncAudioId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm transition-all hover:bg-slate-750"
            >
              <option value="">-- Choose Audio Source --</option>
              {audioClips.map(clip => (
                <option key={clip.id} value={clip.id}>
                  🔊 {clip.voiceName}: "{clip.text.substring(0, 30)}..."
                </option>
              ))}
            </select>
          </div>

          {syncError && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-xs text-red-200 flex items-start gap-2">
              <span className="text-red-400 font-bold">!</span> {syncError}
            </div>
          )}

          <div className="pt-4">
            <Button 
              onClick={handleLipSync}
              isLoading={isSyncing}
              disabled={!syncVideoId || !syncAudioId}
              className="w-full py-4 text-base shadow-lg shadow-blue-900/20"
              variant="primary"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Lip Sync Video
            </Button>
            <p className="text-center text-[10px] text-slate-500 mt-3">
              Uses Fal AI sync-lipsync/v2. Result adds to your playlist.
            </p>
          </div>
        </div>
      </div>

      {/* Column 3: Preview Player */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="flex-1 bg-black rounded-xl border border-slate-800 overflow-hidden relative flex flex-col shadow-2xl min-h-[400px]">
          {/* Hidden Audio Player for sync */}
          <audio ref={audioRef} className="hidden" />

          {/* Video Container - Fixed height with proper aspect ratio handling */}
          <div className="relative flex items-center justify-center bg-black" style={{ height: 'calc(100vh - 280px)', minHeight: '400px', maxHeight: '700px' }}>
            {isStitching && (
              <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center text-white">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                <h3 className="text-lg font-bold">Stitching Videos...</h3>
                <p className="text-sm text-slate-400 mt-2">Processing frame by frame: {stitchProgress}%</p>
              </div>
            )}
            
            {currentPlayingIndex !== null ? (
              <>
                <video
                  ref={videoRef}
                  className="max-h-full max-w-full object-contain"
                  style={{ aspectRatio: '9/16' }}
                  controls={false}
                  onEnded={handleVideoEnded}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onClick={togglePlayPause}
                />
                
                <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs text-white backdrop-blur-md z-10">
                  Clip {currentPlayingIndex + 1} / {playlist.length}
                </div>
                {selectedAudioId && (
                  <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs text-purple-200 backdrop-blur-md z-10 flex items-center gap-2">
                    <Music className="w-3 h-3" />
                    Audio On
                  </div>
                )}
              </>
            ) : (
               <div className="text-center text-slate-600 p-8">
                 <Film className="w-16 h-16 mx-auto mb-4 opacity-20" />
                 <p className="text-lg font-medium text-slate-400">Ready to Preview</p>
                 <p className="text-sm mt-2 max-w-xs mx-auto">
                  Select 'Play Sequence' or click a clip to start.
                 </p>
               </div>
            )}
          </div>

          {/* Custom Controls Bar */}
          {currentPlayingIndex !== null && (
            <div className="bg-slate-900 border-t border-slate-800 p-3 flex flex-col gap-2 select-none">
              <div className="relative group h-4 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:transition-all"
                />
                <div 
                  className="h-1.5 bg-blue-600 rounded-l-lg pointer-events-none absolute top-[5px] left-0"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={togglePlayPause}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 text-white transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>
                  
                  <div className="text-xs font-mono text-slate-400">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                   <button 
                     disabled={currentPlayingIndex === 0}
                     onClick={() => setCurrentPlayingIndex(prev => prev! - 1)}
                     className="p-2 hover:bg-slate-800 rounded text-slate-400 disabled:opacity-30"
                   >
                     <SkipBack className="w-4 h-4" />
                   </button>
                   <button 
                     disabled={currentPlayingIndex === playlist.length - 1}
                     onClick={() => setCurrentPlayingIndex(prev => prev! + 1)}
                     className="p-2 hover:bg-slate-800 rounded text-slate-400 disabled:opacity-30"
                   >
                     <SkipForward className="w-4 h-4" />
                   </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex justify-between items-center shadow-lg">
          <div>
             <h3 className="font-semibold text-white">Final Output</h3>
             <p className="text-xs text-slate-400">
              Resolution: High Quality • Total Clips: {playlist.length} • Audio: {selectedAudioId ? 'Yes' : 'No'}
             </p>
          </div>
          <Button 
            variant="secondary" 
            onClick={handleExport}
            disabled={currentPlayingIndex === null}
          >
             <Check className="w-4 h-8 mr-2" />
             Export Video
          </Button>
        </div>
      </div>
    </div>
  );
};