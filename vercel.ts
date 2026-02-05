import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "vite",
  bunVersion: "1.3.3",
  buildCommand: "bun run build",
  devCommand: "bun run dev:vite",
  installCommand: "bun install",
  outputDirectory: "dist",
};
