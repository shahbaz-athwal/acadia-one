import { google } from "@ai-sdk/google";

export const GEMINI_MODEL_ID = "gemini-3-flash-preview";

export const geminiModel = google(GEMINI_MODEL_ID);
