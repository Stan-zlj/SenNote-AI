
import { GoogleGenAI, Type, Modality } from "@google/genai";

// 动态获取客户端，确保 API_KEY 环境在调用时是最新的
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * 极速闪回：优化报错处理，确保用户能拷贝错误信息
 */
export const fastQuery = async (prompt: string) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.1,
        maxOutputTokens: 800,
      }
    });
    return response.text;
  } catch (error: any) {
    console.error("Gemini FastQuery Error:", error);
    // 返回包含具体原因的字符串，方便用户在界面上选取拷贝
    if (error.message === "API_KEY_MISSING") {
      return "查询失败：检测到 API Key 未配置，请联系管理员或检查环境设置。";
    }
    return `查询失败：${error.message || '网络连接中断或 API 限制'}`;
  }
};

export const quickQuery = async (prompt: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });
  return response.text;
};

export const deepAnalysis = async (parts: any[]) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
  });
  return response.text;
};

export const createChat = (systemInstruction?: string) => {
  const ai = getAIClient();
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: { systemInstruction }
  });
};

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
  const prompt = `Generate a JSON mind map for: "${topic}". Structure: { "label": "string", "children": [] }`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  try { return JSON.parse(response.text || '{}'); } catch (e) { return null; }
};

export function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}
