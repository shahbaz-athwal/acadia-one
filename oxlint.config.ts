import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import vitest from "ultracite/oxlint/vitest";

const vitestForBun = defineConfig({
  ...vitest,
  overrides: vitest.overrides?.map((override) => ({
    ...override,
    rules: {
      ...override.rules,
      "vitest/prefer-importing-vitest-globals": "off",
    },
  })),
});

export default defineConfig({
  extends: [core, react, tanstack, vitestForBun],
  ignorePatterns: [...(core.ignorePatterns ?? []), "src/components/ui/**/*"],
  options: {
    typeAware: true,
    typeCheck: true,
  },
  rules: {
    "func-style": "off",
  },
});
