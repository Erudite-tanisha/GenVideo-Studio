import React, { useState } from "react";
import { TimelineEditor } from "../components/TimelineEditor";
import { VideoClip } from "../types";
import { exportTimeline } from "../services/timelineExport";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "../components/Button";

interface TimelineClip {
  id: string;
  videoClip: VideoClip;
  startTime: number;
  duration: number;
  track: "a-roll" | "b-roll";
}

interface TimelinePageProps {
  aRoll: VideoClip | null;
  bRolls: VideoClip[];
  onBack?: () => void;
}

export const TimelinePage: React.FC<TimelinePageProps> = ({
  aRoll,
  bRolls,
  onBack,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);

  const handleExport = async (timeline: TimelineClip[]) => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const videoUrl = await exportTimeline(timeline, (progress) => {
        setExportProgress(progress);
      });

      setExportedVideoUrl(videoUrl);
      
      // Automatically download
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `edited_video_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export video. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // if (!aRoll) {
  //   return (
  //     <div className="w-full h-screen bg-slate-950 flex items-center justify-center">
  //       <div className="text-center">
  //         <p className="text-slate-400 mb-4">No A-roll video provided</p>
  //         {onBack && (
  //           <Button onClick={onBack} variant="secondary">
  //             <ArrowLeft className="w-4 h-4 mr-2" />
  //             Go Back
  //           </Button>
  //         )}
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="relative w-full h-screen">
      {/* Back Button */}
      {/* {onBack && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 z-50 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      )} */}

      {/* Export Progress Overlay */}
      {isExporting && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-slate-900 rounded-xl p-8 max-w-md w-full mx-4 border border-slate-800">
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                Exporting Video...
              </h3>
              <p className="text-slate-400 mb-4">
                Rendering timeline with A-roll and B-roll overlays
              </p>

              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>

              <p className="text-sm text-slate-500 mt-2">{exportProgress}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Overlay */}
      {exportedVideoUrl && !isExporting && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-slate-900 rounded-xl p-8 max-w-md w-full mx-4 border border-slate-800">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                Export Complete!
              </h3>
              <p className="text-slate-400 mb-6">
                Your video has been downloaded successfully.
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={() => setExportedVideoUrl(null)}
                  variant="secondary"
                  className="flex-1"
                >
                  Continue Editing
                </Button>
                <a
                  href={exportedVideoUrl}
                  download={`edited_video_${Date.now()}.webm`}
                  className="flex-1"
                >
                  <Button variant="primary" className="w-full">
                    Download Again
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      

      {/* Timeline Editor */}
      <TimelineEditor aRoll={aRoll} bRolls={bRolls} onExport={handleExport} />


    </div>
  );
};