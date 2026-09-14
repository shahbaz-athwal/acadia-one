import { defineConfig } from "drizzle-kit";

import { DEFAULT_DATABASE_URL, resolveDatabasePath } from "./src/db/path";

export default defineConfig({
  dbCredentials: {
    url: resolveDatabasePath(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL),
  },
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./src/db/schema.ts",
});
