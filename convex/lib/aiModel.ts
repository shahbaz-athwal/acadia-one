"use node";

import { google } from "@ai-sdk/google";
import { withTracing } from "@posthog/ai";
import { posthog } from "./posthog";

export const GEMINI_MODEL_ID = "gemini-3-flash-preview";

export const geminiModel = withTracing(google(GEMINI_MODEL_ID), posthog, {});
