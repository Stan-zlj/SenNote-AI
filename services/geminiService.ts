
import { GoogleGenAI, Type, Modality } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const quickQuery = async (prompt: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });
  return response.text;
};

// Fix: Added missing deepAnalysis function for document and multimodal analysis using Pro model
export const deepAnalysis = async (parts: any[]) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
  });
  return response.text;
};

// Fix: Added missing speakText function for Text-to-Speech using the specialized TTS model
export const speakText = async (text: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const generateMindMap = async (topic: string) => {
  const ai = getAIClient();
  const prompt = `Generate a hierarchical mind map structure for the topic: "${topic}". 
  Return ONLY a raw JSON object with this structure: { "label": "string", "children": [ { "label": "string", "children": [] } ] }.
  Depth should be at least 3 levels. Avoid extra text or markdown formatting outside the JSON.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });
  
  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse mind map JSON", e);
    return null;
  }
};

export const translateText = async (text: string, targetLang: string = "Chinese") => {
  const ai = getAIClient();
  const prompt = `Translate to ${targetLang}: "${text}"`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });
  return response.text;
};
