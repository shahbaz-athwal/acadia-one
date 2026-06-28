import { drizzle } from "drizzle-orm/bun-sqlite";

const databaseUrl = process.env.DATABASE_URL ?? "file:./local.db";

export const db = drizzle(databaseUrl, { jit: true });
