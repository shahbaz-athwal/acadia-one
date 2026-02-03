"use node";
import { PostHog } from "posthog-node";

const key = process.env.POSTHOG_API_KEY;

if (!key) {
  throw new Error("POSTHOG_PUBLIC_KEY is not set");
}

export const posthog = new PostHog(key, {
  host: "https://us.i.posthog.com",
});
