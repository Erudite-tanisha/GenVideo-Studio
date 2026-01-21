import React, { useState } from "react";
import { FileText, Film, RefreshCw, Layers } from "lucide-react";
import { Button } from "./Button";
import { ScriptSegment, VideoClip } from "../types";
import { splitScriptAndGeneratePrompts } from "../services/geminiService";
import { fetchStockVideo } from "@/services/brollService";

interface StockGeneratorProps {
  onVideoGenerated: (video: VideoClip) => void;
}

export const StockGenerator: React.FC<StockGeneratorProps> = ({
  onVideoGenerated,
}) => {
  const [script, setScript] = useState("");
  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [isProcessingScript, setIsProcessingScript] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  const [generatedVideos, setGeneratedVideos] = useState<
    Record<
      string,
      {
        url: string;
        tags: string[];
        score?: number;
      }
    >
  >({});

  const handleProcessScript = async () => {
    if (!script.trim()) return;
    setIsProcessingScript(true);

    try {
      const result = await splitScriptAndGeneratePrompts(script);
      setSegments(result);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to process script");
    } finally {
      setIsProcessingScript(false);
    }
  };

  const handleGenerateClip = async (segment: ScriptSegment) => {
    setGeneratingIds((prev) => new Set(prev).add(segment.id));

    try {
      const { videoUrl, matchedTags, score } = await fetchStockVideo(
        segment.text
      );

      setGeneratedVideos((prev) => ({
        ...prev,
        [segment.id]: {
          url: videoUrl,
          tags: matchedTags,
          score,
        },
      }));

      const newClip: VideoClip = {
        id: segment.id,
        url: videoUrl,
        prompt: segment.visualPrompt,
        scriptSegment: segment.text,
        type: "stock",
        createdAt: Date.now(),
      };

      onVideoGenerated(newClip);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to fetch stock video");
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(segment.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Script Input */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-400" />
          Script to B-Roll Video
        </h2>

        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Enter your script..."
          className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white"
        />

        <div className="flex justify-end mt-4">
          <Button
            onClick={handleProcessScript}
            isLoading={isProcessingScript}
            disabled={!script.trim()}
          >
            Analyze & Breakdown Script
          </Button>
        </div>
      </div>

      {/* Segments */}
      {segments.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Generated Segments ({segments.length})
          </h3>

          {segments.map((segment, index) => {
            const videoData = generatedVideos[segment.id];

            return (
              <div
                key={segment.id}
                className="bg-slate-900 rounded-xl p-6 border border-slate-800 flex flex-col md:flex-row gap-6"
              >
                {/* Text */}
                <div className="flex-1 space-y-3">
                  <span className="text-xs text-slate-400">
                    Scene {index + 1}
                  </span>

                  <p className="text-slate-200 italic">"{segment.text}"</p>

                  {/* Matching Tags */}
                  {videoData?.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {videoData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 rounded-md bg-slate-700 text-slate-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Video */}
                <div className="w-full md:w-80">
                  {videoData ? (
                    <div className="space-y-2">
                      <video
                        src={videoData.url}
                        controls
                        className="w-full rounded-lg bg-black aspect-video"
                      />

                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={generatingIds.has(segment.id)}
                        onClick={() => handleGenerateClip(segment)}
                        className="w-full"
                      >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        Fetch Another Match
                      </Button>
                    </div>
                  ) : (
                    <div className="h-44 bg-slate-950 border border-slate-800 rounded-lg flex flex-col items-center justify-center">
                      <Film className="w-8 h-8 text-slate-600 mb-2" />
                      <Button
                        onClick={() => handleGenerateClip(segment)}
                        isLoading={generatingIds.has(segment.id)}
                      >
                        Fetch Video
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// import React, { useState } from 'react';
// import { FileText, Film, RefreshCw, Layers } from 'lucide-react';
// import { Button } from './Button';
// import { ScriptSegment, VideoClip } from '../types';
// import { splitScriptAndGeneratePrompts } from '../services/geminiService';
// import { generateTextToVideo } from '../services/falService';
// import { fetchStockVideo } from '@/services/brollService';

// interface StockGeneratorProps {
//   onVideoGenerated: (video: VideoClip) => void;
// }

// export const StockGenerator: React.FC<StockGeneratorProps> = ({ onVideoGenerated }) => {
//   const [script, setScript] = useState('');
//   const [segments, setSegments] = useState<ScriptSegment[]>([]);
//   const [isProcessingScript, setIsProcessingScript] = useState(false);
//   const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
//   const [generatedVideos, setGeneratedVideos] = useState<Record<string, string>>({});

//   const handleProcessScript = async () => {
//     if (!script.trim()) return;
//     setIsProcessingScript(true);

//     try {
//       const result = await splitScriptAndGeneratePrompts(script);
//       setSegments(result);
//     } catch (error: any) {
//       console.error(error);
//       const msg = error.message || "Failed to process script.";
//       alert(msg);
//     } finally {
//       setIsProcessingScript(false);
//     }
//   };

//   const handleGenerateClip = async (segment: ScriptSegment) => {
//     setGeneratingIds(prev => new Set(prev).add(segment.id));

//     try {
//       // Generate the video using FAL/Kling
//       const videoUrl = await generateTextToVideo(segment.visualPrompt, 'kling');

//       setGeneratedVideos(prev => ({ ...prev, [segment.id]: videoUrl }));

//       const newClip: VideoClip = {
//         id: segment.id,
//         url: videoUrl,
//         prompt: segment.visualPrompt,
//         scriptSegment: segment.text,
//         type: 'stock',
//         createdAt: Date.now()
//       };

//       onVideoGenerated(newClip);

//     } catch (error: any) {
//       console.error(error);
//       const msg = error.message || "Unknown error";
//       alert(`Generation Failed: ${msg}`);
//     } finally {
//       setGeneratingIds(prev => {
//         const next = new Set(prev);
//         next.delete(segment.id);
//         return next;
//       });
//     }
//   };

//   return (
//     <div className="space-y-8 max-w-5xl mx-auto">
//       {/* Input Section */}
//       <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
//         <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
//           <FileText className="w-5 h-5 text-green-400" />
//           Script to Stock Video
//         </h2>

//         <div className="space-y-4">
//           <textarea
//             value={script}
//             onChange={(e) => setScript(e.target.value)}
//             placeholder="Enter your video script here. We will break it down and generate clips..."
//             className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
//           />
//           <div className="flex justify-end">
//             <Button
//               onClick={handleProcessScript}
//               isLoading={isProcessingScript}
//               disabled={!script.trim()}
//               variant="primary"
//               className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
//             >
//               Analyze & Breakdown Script
//             </Button>
//           </div>
//         </div>
//       </div>

//       {/* Segments List */}
//       {segments.length > 0 && (
//         <div className="space-y-4">
//           <h3 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
//             <Layers className="w-5 h-5" />
//             Generated Segments ({segments.length})
//           </h3>

//           <div className="grid grid-cols-1 gap-6">
//             {segments.map((segment, index) => (
//               <div key={segment.id} className="bg-slate-900 rounded-xl p-6 border border-slate-800 flex flex-col md:flex-row gap-6 items-start">

//                 {/* Segment Details */}
//                 <div className="flex-1 space-y-3">
//                   <div className="flex items-center gap-2 mb-2">
//                     <span className="bg-slate-800 text-slate-300 text-xs font-bold px-2 py-1 rounded">Scene {index + 1}</span>
//                   </div>
//                   <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
//                     <p className="text-sm text-slate-400 font-mono mb-1 text-xs uppercase">Script</p>
//                     <p className="text-slate-200 italic">"{segment.text}"</p>
//                   </div>
//                   <div className="bg-blue-950/30 p-3 rounded-lg border border-blue-900/30">
//                     <p className="text-sm text-blue-400 font-mono mb-1 text-xs uppercase">Visual Prompt</p>
//                     <p className="text-slate-300 text-sm">{segment.visualPrompt}</p>
//                   </div>
//                 </div>

//                 {/* Action / Preview */}
//                 <div className="w-full md:w-80 flex-shrink-0 flex flex-col items-center justify-center">
//                   {generatedVideos[segment.id] ? (
//                     <div className="w-full space-y-2">
//                       <video
//                         src={generatedVideos[segment.id]}
//                         controls
//                         className="w-full rounded-lg shadow-md bg-black aspect-video"
//                       />
//                       <Button
//                         size="sm"
//                         variant="secondary"
//                         onClick={() => handleGenerateClip(segment)}
//                         isLoading={generatingIds.has(segment.id)}
//                         className="w-full text-xs"
//                       >
//                         <RefreshCw className="w-3 h-3 mr-2" />
//                         Regenerate Clip (Kling)
//                       </Button>
//                     </div>
//                   ) : (
//                     <div className="w-full h-44 bg-slate-950 rounded-lg border border-slate-800 flex flex-col items-center justify-center p-4 text-center">
//                       <Film className="w-8 h-8 text-slate-600 mb-2" />
//                       <p className="text-xs text-slate-500 mb-4">No video generated yet</p>
//                       <Button
//                         onClick={() => handleGenerateClip(segment)}
//                         isLoading={generatingIds.has(segment.id)}
//                         className="w-full"
//                       >
//                          Generate with Kling
//                       </Button>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };
