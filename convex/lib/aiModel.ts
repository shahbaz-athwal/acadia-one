"use node";

import { google } from "@ai-sdk/google";
import { withTracing } from "@posthog/ai";
import { posthog } from "./posthog";

export const GEMINI_MODEL_ID = "gemini-3.1-pro-preview";

const GEMINI_INPUT_COST_USD_PER_TOKEN = 2 / 1_000_000;
const GEMINI_OUTPUT_COST_USD_PER_TOKEN = 12 / 1_000_000;

export const geminiModel = withTracing(google(GEMINI_MODEL_ID), posthog, {
  posthogProperties: {
    $ai_input_cost_usd: GEMINI_INPUT_COST_USD_PER_TOKEN,
    $ai_output_cost_usd: GEMINI_OUTPUT_COST_USD_PER_TOKEN,
  },
});
