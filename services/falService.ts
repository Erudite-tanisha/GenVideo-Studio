import { fal } from "@fal-ai/client";

// Image-to-Video models
const IMAGE_MODEL_ENDPOINTS: Record<string, string> = {
  kling: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
  veo: "fal-ai/veo3.1/fast/image-to-video",
  wan: "fal-ai/wan/v1/image-to-video"
};

// Text-to-Video models (FIXED)
const TEXT_MODEL_ENDPOINTS: Record<string, string> = {
  kling: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
  veo: "fal-ai/veo3.1/fast/text-to-video",
  wan: "fal-ai/wan/v1/text-to-video"
};

// Lipsync
const LIPSYNC_ENDPOINT = "fal-ai/sync-lipsync/v2/pro";

// Get API key from env
const getFalApiKey = (): string => {
  const key = import.meta.env.VITE_FAL_API_KEY;
  if (!key) {
    throw new Error("Missing VITE_FAL_KEY in .env");
  }
  return key;
};

export const isFalKeyConfigured = (): boolean => {
  try {
    const key = import.meta.env.VITE_FAL_API_KEY;
    return !!(key && key !== "Enter-Your-Fal-Key-Here");
  } catch {
    return false;
  }
};

const validateKey = (key: string) => {
  if (!key || key === "Enter-Your-Fal-Key-Here") {
    return "FAL_KEY is missing. Please set VITE_FAL_KEY in your .env file.";
  }
  if (!key.includes(":")) {
    return "Invalid FAL_KEY format. Must be 'key_id:key_secret'.";
  }
  return null;
};

// IMAGE → VIDEO WITH PROMPT
export const generateSubjectVideo = async (
  imageFile: File,
  prompt: string,
  duration: number,
  modelId: string = "kling",
  userApiKey?: string
): Promise<string> => {
  
  const apiKey = userApiKey || getFalApiKey();
  const keyError = validateKey(apiKey);
  if (keyError) throw new Error(keyError);

  fal.config({ credentials: apiKey });

  const base64Image = await fileToBase64(imageFile);
  const endpointUrl = IMAGE_MODEL_ENDPOINTS[modelId] || IMAGE_MODEL_ENDPOINTS["kling"];

  try {
    const result = await fal.subscribe(endpointUrl, {
      input: {
        prompt,
        image_url: base64Image,
        duration: duration.toString(),
        aspect_ratio: "16:9"
      },
      logs: true,
    });

    return result.data?.video?.url || result.data?.url;
  } catch (error: any) {
    throw new Error(error.message || "Failed to generate video");
  }
};

// TEXT → VIDEO
export const generateTextToVideo = async (
  prompt: string,
  modelId: string = "kling",
  userApiKey?: string,
  imageUrl?: string  // optional image conditioning
): Promise<string> => {
  
  const apiKey = userApiKey || getFalApiKey();
  const keyError = validateKey(apiKey);
  if (keyError) throw new Error(keyError);

  fal.config({ credentials: apiKey });

  const endpointUrl = TEXT_MODEL_ENDPOINTS[modelId] || TEXT_MODEL_ENDPOINTS["kling"];

  const input: any = {
    prompt,
    duration: "5",
    aspect_ratio: "9:16"
  };

  if (imageUrl) input.image_url = imageUrl;

  try {
    const result = await fal.subscribe(endpointUrl, {
      input,
      logs: true,
    });

    return result.data?.video?.url || result.data?.url;
  } catch (error: any) {
    throw new Error(error.message || "Failed to generate text-to-video");
  }
};

// LIP SYNC
export const generateLipSync = async (
  videoUrl: string,
  audioUrl: string,
  userApiKey?: string
): Promise<string> => {

  const apiKey = userApiKey || getFalApiKey();
  const keyError = validateKey(apiKey);
  if (keyError) throw new Error(keyError);

  fal.config({ credentials: apiKey });

  try {
    const result = await fal.subscribe(LIPSYNC_ENDPOINT, {
      input: {
        video_url: videoUrl,
        audio_url: audioUrl,
        sync_mode: "remap"
      },
      logs: true,
    });

    return result.data?.video?.url;
  } catch (error: any) {
    throw new Error(error.message || "Failed to generate lip sync video");
  }
};

// Convert File to Base64
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
