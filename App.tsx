import React, { useState } from 'react';
import { AppSection, VideoClip, AudioClip } from './types';
import { SubjectGenerator } from './components/SubjectGenerator';
import { StockGenerator } from './components/StockGenerator';
import { VoiceGenerator } from './components/VoiceGenerator';
import { Stitcher } from './components/Stitcher';
import { Clapperboard, User, Layers, PlaySquare, Mic } from 'lucide-react';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.SUBJECT);
  const [generatedClips, setGeneratedClips] = useState<VideoClip[]>([]);
  const [generatedAudioClips, setGeneratedAudioClips] = useState<AudioClip[]>([]);

  const handleVideoGenerated = (newClip: VideoClip) => {
    setGeneratedClips(prev => [...prev, newClip]);
  };

  const handleAudioGenerated = (newClip: AudioClip) => {
    setGeneratedAudioClips(prev => [...prev, newClip]);
  };

  const navItems = [
    { id: AppSection.SUBJECT, label: 'A-Roll Video', icon: User },
    { id: AppSection.STOCK, label: 'B-Roll Video', icon: Layers },
    { id: AppSection.VOICE, label: 'Voice Generator', icon: Mic },
    { id: AppSection.STITCH, label: 'Stitch & Preview', icon: PlaySquare },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-white">
            <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-2 rounded-lg">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            GenVideo<span className="text-slate-500 font-light"></span>
          </div>
          
          <nav className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Stats Bar */}
        <div className="mb-8 flex justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full border border-slate-800 text-xs text-slate-400">
            <span>Library: {generatedClips.length} clips, {generatedAudioClips.length} audio</span>
            {generatedClips.length > 0 && activeSection !== AppSection.STITCH && (
              <button 
                onClick={() => setActiveSection(AppSection.STITCH)} 
                className="text-blue-400 hover:underline ml-2"
              >
                Go to Stitching →
              </button>
            )}
          </div>
        </div>

        {/* 
          Keep-Alive: Toggle visibility instead of unmounting to preserve state 
        */}
        <div className={activeSection === AppSection.SUBJECT ? "block animate-in fade-in slide-in-from-bottom-4 duration-500" : "hidden"}>
          <SubjectGenerator onVideoGenerated={handleVideoGenerated} />
        </div>
        
        <div className={activeSection === AppSection.STOCK ? "block animate-in fade-in slide-in-from-bottom-4 duration-500" : "hidden"}>
          <StockGenerator onVideoGenerated={handleVideoGenerated} />
        </div>

        <div className={activeSection === AppSection.VOICE ? "block animate-in fade-in slide-in-from-bottom-4 duration-500" : "hidden"}>
          <VoiceGenerator onAudioGenerated={handleAudioGenerated} />
        </div>
        
        <div className={activeSection === AppSection.STITCH ? "block animate-in fade-in slide-in-from-bottom-4 duration-500" : "hidden"}>
          <Stitcher 
            clips={generatedClips} 
            audioClips={generatedAudioClips} 
            onVideoGenerated={handleVideoGenerated}
          />
        </div>
      </main>
    </div>
  );
};

export default App;