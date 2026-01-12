const ELEVEN_LABS_MODEL_ID = "eleven_v3";

// Check if API key exists
export const isElevenLabsKeyConfigured = (): boolean => {
  return !!import.meta.env.VITE_ELEVEN_LABS_API_KEY;
};

const getApiKey = (userKey?: string): string => {
  const key = userKey || import.meta.env.VITE_ELEVEN_LABS_API_KEY;

  if (!key) {
    throw new Error(
      "ElevenLabs API Key is missing. Add VITE_ELEVEN_LABS_API_KEY to your .env file."
    );
  }

  return key;
};

export { ELEVEN_LABS_MODEL_ID, getApiKey };

export interface Voice {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
}

// Fetch Voices
export const getVoices = async (userApiKey?: string): Promise<Voice[]> => {
  const apiKey = getApiKey(userApiKey);

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail?.message || "Failed to fetch voices");
    }

    const data = await response.json();

    return data.voices.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      preview_url: v.preview_url,
      category: v.category,
    }));
  } catch (error) {
    console.error("[ElevenLabs] Fetch voices failed:", error);
    throw error;
  }
};

// Generate Speech
export const generateSpeech = async (
  text: string,
  voiceId: string,
  userApiKey?: string
): Promise<string> => {
  const apiKey = getApiKey(userApiKey);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          model_id: ELEVEN_LABS_MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[ElevenLabs] API Error:", error);
      throw new Error(error.detail?.message || "Failed to generate speech");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob); // returns audio URL
  } catch (error) {
    console.error("[ElevenLabs] Speech generation failed:", error);
    throw error;
  }
};
