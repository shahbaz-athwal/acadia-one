import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: { port: 3000 },
});
