import React, { useState } from 'react';
import { Upload, Sparkles, RefreshCw, Video, Settings2, AlertCircle, Copy, Clock } from 'lucide-react';
import { VideoClip } from '../types';
import { Button } from './Button';
import { generateSubjectVideo } from '../services/falService';
import { enhancePrompt } from '../services/geminiService';

interface SubjectGeneratorProps {
  onVideoGenerated: (video: VideoClip) => void;
}

const MODELS = [
  { id: 'kling', name: 'Kling 2.5', description: 'High motion quality, realistic' },
  { id: 'veo', name: 'Veo', description: 'Google DeepMind video generation' },
  { id: 'wan', name: 'Wan', description: 'Artistic and stylized results' },
];

export const SubjectGenerator: React.FC<SubjectGeneratorProps> = ({ onVideoGenerated }) => {
  const [selectedModel, setSelectedModel] = useState('kling');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [numOutputs, setNumOutputs] = useState(1);
  const [duration, setDuration] = useState(5); // Default to 5s (Kling Standard)
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!prompt) return;
    setIsEnhancing(true);
    setPromptError(null);
    try {
      const enhanced = await enhancePrompt(prompt);
      setPrompt(enhanced);
    } catch (error: any) {
      console.error("Failed to enhance prompt", error);
      if ((error)) {
        setPromptError("API Key Expired. Please renew.");
      } else {
        setPromptError("Failed to enhance prompt.");
      }
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleRenewKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setPromptError(null);
    }
  };

  const handleGenerate = async () => {
    if (!image) {
      setError("Please provide a subject image.");
      return;
    }

    setIsGenerating(true);
    setGeneratedUrls([]);
    setError(null);

    try {
      const promises = Array.from({ length: numOutputs }).map(() => 
        generateSubjectVideo(
          image, 
          prompt || "Animate this character naturally", 
          duration,
          selectedModel
        )
      );
      
      const results = await Promise.all(promises);
      
      setGeneratedUrls(results);

      results.forEach(url => {
        const newClip: VideoClip = {
          id: crypto.randomUUID(),
          url: url,
          prompt: prompt,
          duration: duration,
          type: 'subject',
          createdAt: Date.now()
        };
        onVideoGenerated(newClip);
      });

    } catch (error: any) {
      console.error(error);
      const msg = error.message || "Unknown error occurred";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 bg-slate-900 rounded-xl border border-slate-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Inputs */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-400" />
              Subject Video Setup
            </h2>
            
            {/* Model, Output Count & Duration Selector */}
            <div className="grid grid-cols-1 gap-6 mb-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Select Model
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                        selectedModel === model.id
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <span className="font-semibold text-sm">{model.name}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  {MODELS.find(m => m.id === selectedModel)?.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Copy className="w-4 h-4" />
                    Outputs
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        onClick={() => setNumOutputs(num)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                          numOutputs === num
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Duration
                  </label>
                  <div className="flex gap-2">
                    {[5, 10].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setDuration(sec)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                          duration === sec
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                  
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-400">Subject Image</label>
              <div className={`relative border-2 border-dashed rounded-lg p-6 hover:bg-slate-800/50 transition-colors text-center cursor-pointer ${error && !image ? 'border-red-500' : 'border-slate-700'}`}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-md shadow-md" />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Upload className="w-8 h-8 mb-2" />
                    <span className="text-sm">Click to upload subject image</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-slate-400">Motion Prompt</label>
                <div className="flex items-center gap-2">
                  {promptError && (
                     <button 
                       onClick={handleRenewKey}
                       className="text-xs text-red-400 hover:underline flex items-center gap-1"
                     >
                       {promptError} 
                       <span className="underline">Renew Key</span>
                     </button>
                  )}
                   <button 
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancing || !prompt}
                    className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                    Enhance Prompt
                  </button>
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe how the subject should move (e.g., 'The character smiles and waves slowly')..."
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg flex items-start gap-3">
                 <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                 <div className="space-y-1">
                   <p className="font-semibold text-red-200 text-sm">Generation Failed</p>
                   <p className="text-xs text-red-300 break-words">{error}</p>
                 </div>
              </div>
            )}

            <Button 
              onClick={handleGenerate} 
              isLoading={isGenerating} 
              className="w-full mt-4"
            >
              Generate {numOutputs} Video{numOutputs > 1 ? 's' : ''} ({duration}s)
            </Button>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-950 rounded-xl p-6 flex flex-col items-center justify-start border border-slate-800 min-h-[400px] overflow-y-auto custom-scrollbar">
          {isGenerating ? (
            <div className="text-center space-y-4 my-auto">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="text-slate-400 animate-pulse">
                Generating {numOutputs} video{numOutputs > 1 ? 's' : ''} ({duration}s)...
              </p>
              <p className="text-xs text-slate-600">This may take a minute.</p>
            </div>
          ) : generatedUrls.length > 0 ? (
            <div className="space-y-6 w-full">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Results ({generatedUrls.length})</h3>
              <div className={`grid gap-4 ${generatedUrls.length > 1 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-1' : 'grid-cols-1'}`}>
                {generatedUrls.map((url, idx) => (
                  <div key={idx} className="space-y-2">
                     <div className="relative group">
                       <video 
                         src={url} 
                         controls 
                         autoPlay={idx === 0}
                         loop
                         className="w-full rounded-lg shadow-lg border border-slate-800"
                       />
                       <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          Video #{idx + 1}
                       </div>
                     </div>
                  </div>
                ))}
              </div>
              <Button 
                variant="secondary" 
                onClick={handleGenerate}
                className="w-full sticky bottom-0 shadow-lg"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate All
              </Button>
            </div>
          ) : (
            <div className="text-center text-slate-500 my-auto">
              <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Generated videos will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};