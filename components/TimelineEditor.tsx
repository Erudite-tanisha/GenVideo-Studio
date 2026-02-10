import React, { useState, useRef, useEffect } from "react";
import { VideoClip } from "../types";
import {
  Play,
  Pause,
  Download,
  Trash2,
  Scissors,
  ZoomIn,
  ZoomOut,
  SkipBack,
  SkipForward,
  Film,
  Layers,
  Clock,
  Maximize2,
  Upload,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "./Button";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";


const ffmpeg = new FFmpeg();


interface TimelineClip {
  id: string;
  videoClip: VideoClip;
  startTime: number;
  duration: number;
  track: "a-roll" | "b-roll";
}

interface TimelineEditorProps {
  aRoll: VideoClip | null;
  bRolls: VideoClip[];
  onExport: (timeline: TimelineClip[]) => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  aRoll,
  bRolls: initialBRolls,
  onExport,
}) => {
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  const [bRolls, setBRolls] = useState<VideoClip[]>(initialBRolls);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedClip, setDraggedClip] = useState<VideoClip | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingTimelineClip, setIsDraggingTimelineClip] = useState(false);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>("");
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const PIXEL_PER_SECOND = 50 * zoom;
  const TIMELINE_HEIGHT = 120;
  const TRACK_HEIGHT = 60;
  const TRACK_LABEL_WIDTH = 80;


  // FIXED: Added FFmpeg loading useEffect
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        if (!ffmpegLoaded) {
          console.log("Loading FFmpeg...");
          await ffmpeg.load({
            coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
            wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
          });
          setFfmpegLoaded(true);
          console.log("FFmpeg loaded successfully");
        }
      } catch (error) {
        console.error("Failed to load FFmpeg:", error);
      }
    };
    loadFFmpeg();
  }, [ffmpegLoaded]);


  useEffect(() => {
    setBRolls(initialBRolls);
  }, [initialBRolls]);

  useEffect(() => {
    if (aRoll && timelineClips.length === 0) {
      const aRollClip: TimelineClip = {
        id: crypto.randomUUID(),
        videoClip: aRoll,
        startTime: 0,
        duration: aRoll.duration || 45,
        track: "a-roll",
      };
      setTimelineClips([aRollClip]);
    }
  }, [aRoll]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const maxTime = Math.max(
          ...timelineClips.map((c) => c.startTime + c.duration),
          0
        );
        if (prev >= maxTime) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, timelineClips]);

  useEffect(() => {
    if (!videoRef.current) return;

    const activeClips = timelineClips.filter(
      (clip) =>
        currentTime >= clip.startTime &&
        currentTime < clip.startTime + clip.duration
    );

    const activeClip =
      activeClips.find((c) => c.track === "b-roll") || activeClips[0];

    if (activeClip) {
      const clipTime = currentTime - activeClip.startTime;
      if (videoRef.current.src !== activeClip.videoClip.url) {
        videoRef.current.src = activeClip.videoClip.url;
      }
      videoRef.current.currentTime = clipTime;

      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [currentTime, timelineClips, isPlaying]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingVideo(true);

    try {
      const newClips: VideoClip[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.type.startsWith("video/")) {
          alert(`${file.name} is not a video file`);
          continue;
        }

        const url = URL.createObjectURL(file);
        const duration = await getVideoDuration(url);

        const newClip: VideoClip = {
          id: crypto.randomUUID(),
          url: url,
          prompt: file.name.replace(/\.[^/.]+$/, ""),
          duration: duration,
          type: "upload",
          createdAt: Date.now(),
        };

        newClips.push(newClip);
      }

      setBRolls((prev) => [...prev, ...newClips]);
    } catch (error) {
      console.error("Error uploading videos:", error);
      alert("Error uploading videos. Please try again.");
    } finally {
      setUploadingVideo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const getVideoDuration = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        resolve(video.duration);
      };

      video.onerror = () => {
        reject(new Error("Failed to load video"));
      };

      video.src = url;
    });
  };

  const handleRemoveBRoll = (clipId: string) => {
    setBRolls((prev) => prev.filter((c) => c.id !== clipId));
    setTimelineClips((prev) => prev.filter((c) => c.videoClip.id !== clipId));
  };

  const handleDragStart = (e: React.DragEvent, clip: VideoClip) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", clip.id);

    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = "0.7";
    dragImage.style.transform = "rotate(-3deg)";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 50, 50);
    setTimeout(() => document.body.removeChild(dragImage), 0);

    setDraggedClip(clip);
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
};


  const handleDrop = (e: React.DragEvent, track: "a-roll" | "b-roll") => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedClip || !timelineRef.current) {
      setIsDragging(false);
      setDraggedClip(null);
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.parentElement?.scrollLeft || 0;

    const x = e.clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH;
    const startTime = Math.max(0, x / PIXEL_PER_SECOND);

    const newClip: TimelineClip = {
      id: crypto.randomUUID(),
      videoClip: draggedClip,
      startTime: Math.round(startTime * 10) / 10,
      duration: draggedClip.duration || 3,
      track: track,
    };

    setTimelineClips((prev) => [...prev, newClip]);
    setDraggedClip(null);
    setIsDragging(false);
  };

  const handleClipClick = (clipId: string) => {
    setSelectedClip(clipId);
    const clip = timelineClips.find((c) => c.id === clipId);
    if (clip) {
      setCurrentTime(clip.startTime);
    }
  };

  const handleClipMouseDown = (
    e: React.MouseEvent,
    clipId: string,
    clipStartTime: number
  ) => {
    e.stopPropagation();

    const clip = timelineClips.find((c) => c.id === clipId);
    // if (clip?.track === "a-roll") {
    //   setSelectedClip(clipId);
    //   setCurrentTime(clipStartTime);
    //   return;
    // }

    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.parentElement?.scrollLeft || 0;
    const clickX = e.clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH;
    const clipPixelPosition = clipStartTime * PIXEL_PER_SECOND;

    setDragOffset(clickX - clipPixelPosition);
    setIsDraggingTimelineClip(true);
    setDraggingClipId(clipId);
    setSelectedClip(clipId);
    setIsPlaying(false);
  };

  useEffect(() => {
    if (!isDraggingTimelineClip || !draggingClipId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.parentElement?.scrollLeft || 0;

      const x =
        e.clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH - dragOffset;
      const newStartTime = Math.max(0, x / PIXEL_PER_SECOND);

      setTimelineClips((prev) =>
        prev.map((clip) =>
          clip.id === draggingClipId
            ? { ...clip, startTime: Math.round(newStartTime * 10) / 10 }
            : clip
        )
      );
    };

    const handleMouseUp = () => {
      setIsDraggingTimelineClip(false);
      setDraggingClipId(null);
      setDragOffset(0);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDraggingTimelineClip,
    draggingClipId,
    PIXEL_PER_SECOND,
    dragOffset,
    TRACK_LABEL_WIDTH,
  ]);

  const handleDeleteClip = (clipId: string) => {
    setTimelineClips((prev) => prev.filter((c) => c.id !== clipId));
    if (selectedClip === clipId) {
      setSelectedClip(null);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (isDraggingPlayhead || isDraggingTimelineClip) return;

    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.parentElement?.scrollLeft || 0;

    const x = e.clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH;
    const time = Math.max(0, x / PIXEL_PER_SECOND);

    setCurrentTime(time);
    setIsPlaying(false);
  };

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    setIsPlaying(false);
  };

  useEffect(() => {
    if (!isDraggingPlayhead) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.parentElement?.scrollLeft || 0;

      const x = e.clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH;
      const time = Math.max(0, x / PIXEL_PER_SECOND);

      const maxTime = Math.max(
        ...timelineClips.map((c) => c.startTime + c.duration),
        45
      );

      setCurrentTime(Math.min(time, maxTime));
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPlayhead, PIXEL_PER_SECOND, timelineClips, TRACK_LABEL_WIDTH]);

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleExport = async () => {
    if (timelineClips.length === 0) {
      alert("No clips on timeline to export");
      return;
    }

    if (!ffmpegLoaded) {
      alert("FFmpeg is still loading. Please wait a moment and try again.");
      return;
    }

    setIsExporting(true);
    setExportProgress("Preparing...");

    try {
      // Sort clips by track and start time
      const sorted = [...timelineClips].sort((a, b) => {
        if (a.track !== b.track) {
          return a.track === "a-roll" ? -1 : 1;
        }
        return a.startTime - b.startTime;
      });

      const aRollClips = sorted.filter((c) => c.track === "a-roll");
      const bRollClips = sorted.filter((c) => c.track === "b-roll");

      // Calculate total duration
      const totalDuration = Math.max(
        ...sorted.map((c) => c.startTime + c.duration),
        0
      );

      setExportProgress("Loading videos...");

      // Write all video files to FFmpeg's virtual filesystem
      const fileMap = new Map<string, string>();
      let fileIndex = 0;

      for (const clip of sorted) {
        if (!fileMap.has(clip.videoClip.url)) {
          const fileName = `input${fileIndex}.mp4`;
          const videoData = await fetchFile(clip.videoClip.url);
          await ffmpeg.writeFile(fileName, videoData);
          fileMap.set(clip.videoClip.url, fileName);
          fileIndex++;
        }
      }

      setExportProgress("Building timeline...");

      // Build FFmpeg filter complex command
      let filterComplex = "";
      let inputs: string[] = [];

      // If we have A-roll, use it as the base
      if (aRollClips.length > 0) {
        const aRollClip = aRollClips[0];
        const aRollFile = fileMap.get(aRollClip.videoClip.url)!;
        
        inputs.push("-i", aRollFile);
        
        // Scale and pad A-roll to 1080x1920
        filterComplex = `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[base];`;
        
        let currentOutput = "[base]";
        
        // Overlay each B-roll clip at the appropriate time
        bRollClips.forEach((bClip, idx) => {
          const bRollFile = fileMap.get(bClip.videoClip.url)!;
          const inputIndex = inputs.length / 2; // Each input is 2 args (-i file)
          
          inputs.push("-i", bRollFile);
          
          const nextOutput = idx === bRollClips.length - 1 ? "out" : `tmp${idx}`;
          
          // Scale and overlay B-roll
          filterComplex += `[${inputIndex}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS+${bClip.startTime}/TB[b${idx}];`;
          filterComplex += `${currentOutput}[b${idx}]overlay=enable='between(t,${bClip.startTime},${bClip.startTime + bClip.duration})'[${nextOutput}];`;
          
          currentOutput = `[${nextOutput}]`;
        });
        
        // Remove trailing semicolon
        filterComplex = filterComplex.slice(0, -1);
        
      } else {
        // No A-roll, just concatenate B-rolls
        bRollClips.forEach((clip, idx) => {
          const file = fileMap.get(clip.videoClip.url)!;
          inputs.push("-i", file);
          filterComplex += `[${idx}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[v${idx}];`;
        });
        
        filterComplex += bRollClips.map((_, idx) => `[v${idx}]`).join("") + `concat=n=${bRollClips.length}:v=1:a=0[out]`;
      }

      setExportProgress("Encoding video...");

      // Execute FFmpeg command
      await ffmpeg.exec([
        ...inputs,
        "-filter_complex",
        filterComplex,
        "-map",
        "[out]",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30", // 30 fps output
        "-t",
        totalDuration.toString(),
        "output.mp4",
      ]);

      setExportProgress("Downloading...");

      // Read the output file
      const data = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([data], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      // Trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = `edited-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setExportProgress("Complete!");
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress("");
      }, 2000);

    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please check the console for details.");
      setIsExporting(false);
      setExportProgress("");
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const totalDuration = Math.max(
    ...timelineClips.map((c) => c.startTime + c.duration),
    45
  );

  return (
    <div className="w-full h-screen bg-slate-950 flex flex-col">
      {/* Hidden canvas for video rendering */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Bar */}
      <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Scissors className="w-6 h-6 text-purple-400" />
          <h1 className="text-xl font-bold text-white">Timeline Editor</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-400">
            <Clock className="w-4 h-4 inline mr-1" />
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </div>
          <Button
            onClick={handleExport}
            variant="primary"
            disabled={isExporting || timelineClips.length === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting {exportProgress}%
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export Video
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - B-Roll Library */}
        <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                Library
              </h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingVideo}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-lg flex items-center gap-1.5 transition-all font-medium shadow-lg shadow-blue-600/20"
                title="Upload videos"
              >
                {uploadingVideo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {bRolls.length === 0 ? (
              <div className="text-center text-slate-600 py-10">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm mb-4">No videos available</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg flex items-center gap-2 mx-auto transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Upload Videos
                </button>
              </div>
            ) : (
              bRolls.map((clip) => (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, clip)}
                  onDragEnd={() => {
                    setIsDragging(false);
                    setDraggedClip(null);
                  }}
                  className="group relative bg-slate-800 rounded-lg p-3 cursor-move hover:bg-slate-750 transition-all duration-200 border border-slate-700 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
                >
                  <div className="w-full h-24 bg-black rounded overflow-hidden mb-2 relative">
                    <video
                      src={clip.url}
                      className="w-full h-full object-cover pointer-events-none"
                      muted
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2 mb-2">
                    {clip.prompt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                      {clip.duration?.toFixed(1) || "3.0"}s
                    </span>
                    {clip.type === "upload" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveBRoll(clip.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-red-400 rounded transition-all"
                        title="Remove video"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Area - Full Width Centered Layout */}
        <div className="flex-1 flex flex-col w-full">
          {/* Preview Player - Centered */}
          <div className="h-80 bg-black border-b border-slate-800 flex items-center justify-center relative">
            <div className="flex items-center justify-center w-full h-full">
              <video
                ref={videoRef}
                className="max-h-full object-contain"
                style={{
                  maxWidth: "calc(100vh * 9 / 16 * 0.5)",
                  aspectRatio: "9/16",
                }}
                muted
              />
            </div>

            {/* Playback Controls Overlay */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-4">
              <button
                onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
                className="text-white hover:text-blue-400 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={togglePlayPause}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-white transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-1" />
                )}
              </button>

              <button
                onClick={() => setCurrentTime(currentTime + 5)}
                className="text-white hover:text-blue-400 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Timeline Area */}
          <div className="flex-1 flex flex-col bg-slate-900">
            {/* Timeline Controls */}
            <div className="h-12 border-b border-slate-800 flex items-center justify-between px-9">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <div className="text-xs text-slate-500 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </div>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {selectedClip && (
                <button
                  onClick={() => handleDeleteClip(selectedClip)}
                  className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete Clip
                </button>
              )}
            </div>

            {/* Timeline Tracks */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              <div className="relative" style={{ minWidth: "100%" }}>
                {/* Time Ruler */}
                <div className="h-8 bg-slate-950 border-b border-slate-800 relative flex">
                  <div className="w-20 flex-shrink-0 bg-slate-900 border-r border-slate-800" />
                  <div className="flex-1 relative">
                    {Array.from(
                      { length: Math.ceil(totalDuration / 5) + 1 },
                      (_, i) => i * 5
                    ).map((second) => (
                      <div
                        key={second}
                        className="absolute top-0 h-full border-l border-slate-700"
                        style={{ left: `${second * PIXEL_PER_SECOND}px` }}
                      >
                        <span className="text-[10px] text-slate-500 ml-1">
                          {formatTime(second)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tracks Container */}
                <div
                  ref={timelineRef}
                  className="relative"
                  onClick={handleTimelineClick}
                  style={{
                    minWidth: `${
                      totalDuration * PIXEL_PER_SECOND + TRACK_LABEL_WIDTH
                    }px`,
                  }}
                >
                  {/* A-Roll Track */}
                  <div
                    className="relative border-b border-slate-800 bg-slate-900/50 flex"
                    style={{ height: `${TRACK_HEIGHT}px` }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, "a-roll")}
                  >
                    <div
                      className="flex-shrink-0 bg-slate-900 border-r border-slate-800 flex items-center justify-center"
                      style={{ width: `${TRACK_LABEL_WIDTH}px` }}
                    >
                      <span className="text-xs font-semibold text-purple-400">
                        A-ROLL
                      </span>
                    </div>

                    <div className="flex-1 relative">
                      {timelineClips
                        .filter((clip) => clip.track === "a-roll")
                        .map((clip) => (
                          <div
                            key={clip.id}
                            onMouseDown={(e) =>
                              handleClipMouseDown(e, clip.id, clip.startTime)
                            }
                            className={`absolute top-1 h-14 bg-gradient-to-r from-purple-600 to-purple-500 rounded cursor-pointer transition-all select-none ${
                              selectedClip === clip.id
                                ? "ring-2 ring-white"
                                : "hover:ring-2 hover:ring-purple-400"
                            } ${
                              isDraggingTimelineClip &&
                              draggingClipId === clip.id
                                ? "cursor-grabbing opacity-80"
                                : "cursor-grab"
                            }`}
                            style={{
                              left: `${clip.startTime * PIXEL_PER_SECOND}px`,
                              width: `${clip.duration * PIXEL_PER_SECOND}px`,
                            }}
                          >
                            <div className="p-2 flex flex-col justify-between h-full pointer-events-none">
                              <span className="text-[10px] text-white font-semibold line-clamp-1">
                                {clip.videoClip.prompt}
                              </span>
                              <span className="text-[9px] text-purple-200">
                                {clip.duration.toFixed(1)}s
                              </span>
                            </div>
                          </div>
                        ))}

                      {isDragging && (
                        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded flex items-center justify-center">
                          {/* <span className="text-blue-400 text-sm font-semibold">
                            Drop A-Roll Here
                          </span> */}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* B-Roll Track */}
                  <div
                    className="relative border-b border-slate-800 bg-slate-900/30 flex"
                    style={{ height: `${TRACK_HEIGHT}px` }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, "b-roll")}
                  >
                    <div
                      className="flex-shrink-0 bg-slate-900 border-r border-slate-800 flex items-center justify-center"
                      style={{ width: `${TRACK_LABEL_WIDTH}px` }}
                    >
                      <span className="text-xs font-semibold text-blue-400">
                        B-ROLL
                      </span>
                    </div>

                    <div className="flex-1 relative">
                      {timelineClips
                        .filter((clip) => clip.track === "b-roll")
                        .map((clip) => (
                          <div
                            key={clip.id}
                            onMouseDown={(e) =>
                              handleClipMouseDown(e, clip.id, clip.startTime)
                            }
                            className={`absolute top-1 h-14 bg-gradient-to-r from-blue-600 to-blue-500 rounded transition-all select-none ${
                              selectedClip === clip.id
                                ? "ring-2 ring-white"
                                : "hover:ring-2 hover:ring-blue-400"
                            } ${
                              isDraggingTimelineClip &&
                              draggingClipId === clip.id
                                ? "cursor-grabbing opacity-80"
                                : "cursor-grab"
                            }`}
                            style={{
                              left: `${clip.startTime * PIXEL_PER_SECOND}px`,
                              width: `${clip.duration * PIXEL_PER_SECOND}px`,
                            }}
                          >
                            <div className="p-2 flex flex-col justify-between h-full pointer-events-none">
                              <span className="text-[10px] text-white font-semibold line-clamp-1">
                                {clip.videoClip.prompt}
                              </span>
                              <span className="text-[9px] text-blue-200">
                                {clip.duration.toFixed(1)}s
                              </span>
                            </div>
                          </div>
                        ))}

                      {/* Drop Zone Indicator */}
                      {isDragging && (
                        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded flex items-center justify-center">
                          {/* <span className="text-blue-400 text-sm font-semibold">
                            Drop B-Roll Here
                          </span> */}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    ref={playheadRef}
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{
                      left: `${
                        currentTime * PIXEL_PER_SECOND + TRACK_LABEL_WIDTH
                      }px`,
                      cursor: isDraggingPlayhead ? "grabbing" : "grab",
                    }}
                  >
                    <div
                      className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full cursor-grab active:cursor-grabbing"
                      onMouseDown={handlePlayheadMouseDown}
                    />
                  </div>

                  {/* Playhead */}
                  <div
                    ref={playheadRef}
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{
                      left: `${
                        currentTime * PIXEL_PER_SECOND + TRACK_LABEL_WIDTH
                      }px`,
                      cursor: isDraggingPlayhead ? "grabbing" : "grab",
                    }}
                  >
                    <div
                      className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full cursor-grab active:cursor-grabbing"
                      onMouseDown={handlePlayheadMouseDown}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
