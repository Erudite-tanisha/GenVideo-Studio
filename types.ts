export enum AppSection {
  SUBJECT = 'SUBJECT',
  STOCK = 'STOCK',
  VOICE = 'VOICE',
  STITCH = 'STITCH'
}

export interface VideoClip {
  id: string;
  url: string;
  thumbnail?: string;
  prompt: string;
  duration?: number;
  type: 'subject' | 'stock' | 'upload';
  scriptSegment?: string;
  createdAt: number;
}

export interface AudioClip {
  id: string;
  url: string;
  text: string;
  voiceName: string;
  voiceId: string;
  createdAt: number;
}

export interface ScriptSegment {
  id: string;
  text: string;
  visualPrompt: string;
}

export interface GenerationStatus {
  isGenerating: boolean;
  progress?: number; // 0-100
  message?: string;
}

// Extension to Window for Gemini API Key Picker
declare global {
  // Define the interface expected by the environment (AIStudio)
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}