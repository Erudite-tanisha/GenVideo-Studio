// App.tsx
import { useState } from "react";
import { TimelinePage } from "./pages/TimelinePage";
import { VideoClip, AudioClip } from "./types";
import { Stitcher } from "./components/Stitcher";
import { VoiceGenerator } from "./components/VoiceGenerator";
import { StockGenerator } from "./components/StockGenerator";
import { SubjectGenerator } from "./components/SubjectGenerator";
import { Film, Scissors, Video, Mic, User, Layers } from "lucide-react";

type Page = "home" | "timeline";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [videoClips, setVideoClips] = useState<VideoClip[]>([]);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [activeTab, setActiveTab] = useState<"aroll" | "broll" | "voice" | "stitch">("aroll");

  // Separate A-roll (lip-synced) from B-roll (stock/uploaded)
  const aRoll = videoClips.find((v) => v.type === "subject") || null;
  const bRolls = videoClips.filter((v) => v.type !== "subject");

  const handleVideoGenerated = (video: VideoClip) => {
    setVideoClips((prev) => [...prev, video]);
  };

  const handleAudioGenerated = (audio: AudioClip) => {
    setAudioClips((prev) => [...prev, audio]);
  };

  // Render Timeline Page
  if (currentPage === "timeline") {
    return (
      <TimelinePage
        aRoll={aRoll}
        bRolls={bRolls}
        onBack={() => setCurrentPage("home")}
      />
    );
  }

  // Render Home Page (your existing app)
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Film className="w-7 h-7 text-purple-400" />
                GenVideo
              </h1>

              {/* Tab Navigation */}
              <nav className="flex gap-2">
                <button
                  onClick={() => setActiveTab("aroll")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "aroll"
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <User className="w-4 h-4" />
                  A-Roll Video
                </button>

                <button
                  onClick={() => setActiveTab("broll")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "broll"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Video className="w-4 h-4" />
                  B-Roll Stock
                </button>

                <button
                  onClick={() => setActiveTab("voice")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "voice"
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  Voice Generator
                </button>

                <button
                  onClick={() => setActiveTab("stitch")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === "stitch"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Stitch & Preview
                </button>
              </nav>
            </div>

            {/* Stats & Timeline Button */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="text-slate-400">
                  Clips: <span className="text-white font-semibold">{videoClips.length}</span>
                </div>
                <div className="text-slate-400">
                  Audio: <span className="text-white font-semibold">{audioClips.length}</span>
                </div>
                {aRoll && (
                  <div className="px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-semibold">
                    ✓ A-Roll Ready
                  </div>
                )}
              </div>

              <button
  onClick={() => setCurrentPage("timeline")}
  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2
             bg-gradient-to-r from-purple-600 to-blue-600
             hover:from-purple-500 hover:to-blue-500
             text-white shadow-lg"
>
  <Scissors className="w-4 h-4" />
  Timeline Editor
  {bRolls.length > 0 && (
    <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
      {bRolls.length}
    </span>
  )}
</button>

            </div>
          </div>
        </div>
      </header>

  

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* A-Roll Subject Generator */}
        {activeTab === "aroll" && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-6 h-6 text-purple-400" />
              A-Roll Video Generator
            </h2>
            <SubjectGenerator onVideoGenerated={handleVideoGenerated} />
          </div>
        )}

        {/* B-Roll Stock Generator */}
        {activeTab === "broll" && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Video className="w-6 h-6 text-blue-400" />
              B-Roll Stock Generator
            </h2>
            <StockGenerator onVideoGenerated={handleVideoGenerated} />
          </div>
        )}

        {/* Voice Generator */}
        {activeTab === "voice" && (
          <div>
            <VoiceGenerator onAudioGenerated={handleAudioGenerated} />
          </div>
        )}

        {/* Stitcher */}
        {activeTab === "stitch" && (
          <div>
            <Stitcher
              clips={videoClips}
              audioClips={audioClips}
              onVideoGenerated={handleVideoGenerated}
            />
          </div>
        )}
      </main>

      {/* Floating Timeline Button (Mobile) */}
      {currentPage === "home" && (
        <button
          onClick={() => setCurrentPage("timeline")}
          className="fixed bottom-8 right-8 lg:hidden px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-full shadow-2xl flex items-center gap-3 font-semibold transition-all transform hover:scale-105"
        >
          <Scissors className="w-5 h-5" />
          Timeline
          {bRolls.length > 0 && (
            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {bRolls.length}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export default App;


// import React, { useState } from 'react';
// import { AppSection, VideoClip, AudioClip } from './types';
// import { SubjectGenerator } from './components/SubjectGenerator';
// import { StockGenerator } from './components/StockGenerator';
// import { VoiceGenerator } from './components/VoiceGenerator';
// import { Stitcher } from './components/Stitcher';
// import { Clapperboard, User, Layers, PlaySquare, Mic } from 'lucide-react';

// const App: React.FC = () => {
//   const [activeSection, setActiveSection] = useState<AppSection>(AppSection.SUBJECT);
//   const [generatedClips, setGeneratedClips] = useState<VideoClip[]>([]);
//   const [generatedAudioClips, setGeneratedAudioClips] = useState<AudioClip[]>([]);

//   const handleVideoGenerated = (newClip: VideoClip) => {
//     setGeneratedClips(prev => [...prev, newClip]);
//   };

//   const handleAudioGenerated = (newClip: AudioClip) => {
//     setGeneratedAudioClips(prev => [...prev, newClip]);
//   };

//   const navItems = [
//     { id: AppSection.SUBJECT, label: 'A-Roll Video', icon: User },
//     { id: AppSection.STOCK, label: 'B-Roll Video', icon: Layers },
//     { id: AppSection.VOICE, label: 'Voice Generator', icon: Mic },
//     { id: AppSection.STITCH, label: 'Stitch & Preview', icon: PlaySquare },
//   ];

//   return (
//     <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30">
      
//       {/* Header */}
//       <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
//         <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
//           <div className="flex items-center gap-2 font-bold text-xl text-white">
//             <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-2 rounded-lg">
//               <Clapperboard className="w-5 h-5 text-white" />
//             </div>
//             GenVideo<span className="text-slate-500 font-light"></span>
//           </div>
          
//           <nav className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800 overflow-x-auto">
//             {navItems.map((item) => {
//               const Icon = item.icon;
//               const isActive = activeSection === item.id;
//               return (
//                 <button
//                   key={item.id}
//                   onClick={() => setActiveSection(item.id)}
//                   className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
//                     isActive 
//                       ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
//                       : 'text-slate-400 hover:text-white hover:bg-slate-800'
//                   }`}
//                 >
//                   <Icon className="w-4 h-4" />
//                   {item.label}
//                 </button>
//               );
//             })}
//           </nav>
//         </div>
//       </header>

//       {/* Main Content */}
//       <main className="max-w-7xl mx-auto px-4 py-8">
        
//         {/* Stats Bar */}
//         <div className="mb-8 flex justify-end">
//           <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full border border-slate-800 text-xs text-slate-400">
//             <span>Library: {generatedClips.length} clips, {generatedAudioClips.length} audio</span>
//             {generatedClips.length > 0 && activeSection !== AppSection.STITCH && (
//               <button 
//                 onClick={() => setActiveSection(AppSection.STITCH)} 
//                 className="text-blue-400 hover:underline ml-2"
//               >
//                 Go to Stitching →
//               </button>
//             )}
//           </div>
//         </div>

//         {/* 
//           Keep-Alive: Toggle visibility instead of unmounting to preserve state 
//         */}
//         <div className={activeSection === AppSection.SUBJECT ? "block animate-in fade-in slide-in-from-bottom-4 duration-500" : "hidden"}>
//           <SubjectGenerator onVideoGenerated={handleVideoGenerated} />
//         </div>
        
//         <div className={activeSection === AppSection.STOCK ? "block animate-in fade-in slide-in-from-bottom-4 duration-500" : "hidden"}>
//           <StockGenerator onVideoGenerated={handleVideoGenerated} />
//         </div>

//         <div className={activeSection === AppSection.VOICE ? "block animate-in fade-in slide-in-from-bottom-4 duration-500" : "hidden"}>
//           <VoiceGenerator onAudioGenerated={handleAudioGenerated} />
//         </div>
        
//         <div className={activeSection === AppSection.STITCH ? "block animate-in fade-in slide-in-from-bottom-4 duration-500" : "hidden"}>
//           <Stitcher 
//             clips={generatedClips} 
//             audioClips={generatedAudioClips} 
//             onVideoGenerated={handleVideoGenerated}
//           />
//         </div>
//       </main>
//     </div>
//   );
// };

// export default App;