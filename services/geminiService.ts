import { GoogleGenAI, Type } from "@google/genai";
import { ScriptSegment } from "../types";

const getApiKey = () => {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new Error("Missing VITE_GEMINI_API_KEY in environment variables");
  }
  return key;
};

// Helper to get the AI client
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: getApiKey() });
};

const withRetry = async <T>(
  operation: () => Promise<T>, 
  retries = 3, 
  baseDelay = 2000
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      // Check for rate limits
      const isRateLimit = 
        error.status === 429 || 
        error.code === 429 || 
        (error.message && error.message.includes("429")) ||
        (error.message && error.message.includes("RESOURCE_EXHAUSTED"));

      // Check for invalid key (Do not retry these)
      if (isGeminiApiKeyError(error)) {
        throw error;
      }

      if (isRateLimit && i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`Gemini 429 Rate Limit hit. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
};

export const isGeminiApiKeyError = (error: any): boolean => {
  if (!error) return false;
  
  const msg = error.message || "";
  const status = error.status || error.code;

  if (status === 400 && (msg.includes("API key expired") || msg.includes("API_KEY_INVALID"))) {
    return true;
  }
  
  if (error.details) {
    const detailsStr = JSON.stringify(error.details);
    if (detailsStr.includes("API_KEY_INVALID") || detailsStr.includes("API key expired")) {
      return true;
    }
  }

  return false;
};

// Enhance the prompt
export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
  const ai = getAiClient();
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Enhance the following video generation prompt to be more descriptive, cinematic, and detailed for an AI video generator. 
      Keep it under 60 words. 
      Original Prompt: "${originalPrompt}"
      
      Return ONLY the enhanced prompt, no explanations or additional text.`,
    });
    return response.text || originalPrompt;
  });
};

// Split script and gen prompts
export const splitScriptAndGeneratePrompts = async (fullScript: string): Promise<ScriptSegment[]> => {
  const ai = getAiClient();
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following video script. 
      1. Break the script into logical segments of approximately 2-3 lines or 1-2 sentences each.
      2. For each segment, write a highly detailed visual prompt for a stock video clip (4-5 seconds) that matches the context.
      3. Make the visual prompts cinematic and descriptive for AI video generation.
      
      Script:
      """
      ${fullScript}
      """`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { 
                type: Type.STRING, 
                description: "The segment of the script text" 
              },
              visualPrompt: { 
                type: Type.STRING, 
                description: "A detailed cinematic visual prompt for video generation" 
              }
            },
            required: ["text", "visualPrompt"]
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");
    
    if (!Array.isArray(data)) {
      throw new Error("Invalid response format from Gemini API");
    }
    
    return data.map((item: any) => ({
      id: crypto.randomUUID(),
      text: item.text,
      visualPrompt: item.visualPrompt
    }));
  });
};

// Utility exports
export const ensureApiKeySelected = async () => true;
export const requestApiKeySelection = async () => {};