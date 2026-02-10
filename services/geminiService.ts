import { stringify } from "querystring";
import { ScriptSegment } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ VITE_GEMINI_API_KEY is NOT loaded");
  throw new Error(
    "VITE_GEMINI_API_KEY is missing. Restart Vite after adding it to .env"
  );
}

console.log("✅ Gemini API Key loaded");
const MODEL = "gemini-2.5-flash-lite";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Retry failed");
};

const callGemini = async (prompt: string) => {
  console.log("API_KEY at call time:", API_KEY ? "EXISTS" : "UNDEFINED");
  // console.log("First 10 chars:", API_KEY?.slice(0, 10));
  
  const url = `${ENDPOINT}?key=${API_KEY}`;
  console.log("Request URL:", url.replace(API_KEY || "", "***"));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  return res.json();
};

export const enhancePrompt = async (
  prompt: string
): Promise<string> => {
  return withRetry(async () => {
    const json = await callGemini(`
You are a professional video prompt engineer. Your task is to enhance the given prompt to make it more descriptive, visual, and suitable for video generation.

Guidelines:
- Add vivid visual details (lighting, colors, camera angles, composition)
- Specify mood and atmosphere
- Include motion and action descriptions
- Keep the core idea intact
- Make it cinematic and engaging
- Output should be 2-3 sentences max
- Be specific but concise

Original Prompt:
"""
${prompt}
"""

Enhanced Prompt (respond with ONLY the enhanced prompt, no explanations):
    `);

    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini returned empty response");
    }

    // Return the enhanced prompt directly
    return text.trim();
  });
};

export const splitScriptAndGeneratePrompts = async (
  fullScript: string
): Promise<ScriptSegment[]> => {
  return withRetry(async () => {
    const json = await callGemini(`
Split the following script into logical segments of 1–2 sentences.

Respond ONLY with valid JSON.
No markdown. No explanation.

Format:
[
  { "text": "segment text" }
]

Script:
"""
${fullScript}
"""
    `);

    const text =
      json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini returned empty response");
    }

    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      throw new Error("Invalid JSON format from Gemini");
    }

    return data.map((item: any) => ({
      id: crypto.randomUUID(),
      text: item.text,
      visualPrompt: "",
    }));
  });
};
