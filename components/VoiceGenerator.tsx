import React, { useState, useEffect } from 'react';
import { Mic, Volume2, Music } from 'lucide-react';
import { Button } from './Button';
import { AudioClip } from '../types';
import { getVoices, generateSpeech, Voice } from '../services/elevenLabsService';

interface VoiceGeneratorProps {
  onAudioGenerated: (audio: AudioClip) => void;
}

export const VoiceGenerator: React.FC<VoiceGeneratorProps> = ({ onAudioGenerated }) => {
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [generatedAudios, setGeneratedAudios] = useState<AudioClip[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    setIsLoadingVoices(true);
    setError(null);
    try {
      const fetchedVoices = await getVoices();
      setVoices(fetchedVoices);
      if (fetchedVoices.length > 0) {
        // Default to 'Adam' or first available
        const defaultVoice = fetchedVoices.find(v => v.name === 'Adam') || fetchedVoices[0];
        setSelectedVoice(defaultVoice.voice_id);
      }
    } catch (err: any) {
      setError("Failed to load voices. Check API Key in environment.");
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Please enter text to generate speech.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const audioUrl = await generateSpeech(text, selectedVoice);
      const voiceObj = voices.find(v => v.voice_id === selectedVoice);
      
      const newClip: AudioClip = {
        id: crypto.randomUUID(),
        url: audioUrl,
        text: text,
        voiceName: voiceObj?.name || 'Unknown Voice',
        voiceId: selectedVoice,
        createdAt: Date.now()
      };

      setGeneratedAudios(prev => [newClip, ...prev]);
      onAudioGenerated(newClip);
      
    } catch (err: any) {
      setError(err.message || "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 bg-slate-900 rounded-xl border border-slate-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Inputs */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" />
              Voice Generator
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-400">Select Voice</label>
                {isLoadingVoices ? (
                  <div className="h-10 bg-slate-800 rounded animate-pulse"></div>
                ) : (
                  <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {voices.map(voice => (
                      <option key={voice.voice_id} value={voice.voice_id}>
                        {voice.name} {voice.category ? `(${voice.category})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-400">Script</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter text to convert to speech..."
                  className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-950/30 p-3 rounded border border-red-900/50">
                  {error}
                </div>
              )}

              <Button 
                onClick={handleGenerate} 
                isLoading={isGenerating}
                disabled={!selectedVoice || isLoadingVoices}
                className="w-full"
              >
                <Volume2 className="w-4 h-4 mr-2" />
                Generate Audio
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Library */}
        <div className="bg-slate-950 rounded-xl p-6 border border-slate-800 flex flex-col min-h-[400px]">
          <h3 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
            <Music className="w-4 h-4" />
            Generated Audio Library
          </h3>
          
          <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[500px]">
            {generatedAudios.length === 0 ? (
              <div className="text-center text-slate-600 my-auto py-10">
                <Volume2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Generated audio clips will appear here</p>
              </div>
            ) : (
              generatedAudios.map((clip) => (
                <div key={clip.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-purple-400 block">{clip.voiceName}</span>
                      <p className="text-xs text-slate-300 line-clamp-2" title={clip.text}>"{clip.text}"</p>
                    </div>
                    <span className="text-[10px] text-slate-600 whitespace-nowrap">
                      {new Date(clip.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <audio src={clip.url} controls className="w-full h-8" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};