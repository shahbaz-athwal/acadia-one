import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "file:./local.db";

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
  },
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./src/db/schema.ts",
});
