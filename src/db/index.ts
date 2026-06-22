import { drizzle } from "drizzle-orm/libsql";

const databaseUrl = process.env.DATABASE_URL ?? "file:./local.db";

export const db = drizzle(databaseUrl);
