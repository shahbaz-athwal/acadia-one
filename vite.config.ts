import { fileURLToPath, URL } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const config = defineConfig({
  server: { port: 3000 },
  fmt: {
    ignorePatterns: ["convex/_generated"],
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [
      "src/components/ui",
      "src/components/kokonutui",
      "convex/_generated",
      "pnpm-lock.json",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
