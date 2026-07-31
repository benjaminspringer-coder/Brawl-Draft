import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI {
  if (!_ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY must be set.");
    }
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _ai;
}

/** @deprecated Use getAiClient() instead — this throws at import time if the key is missing. */
export const ai: GoogleGenAI = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    return (getAiClient() as any)[prop];
  },
});
