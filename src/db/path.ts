import { fileURLToPath } from "node:url";

export const DEFAULT_DATABASE_URL = "./local.db";

/**
 * `DATABASE_URL` is read by both the server (`bun:sqlite`) and the migrator
 * (drizzle-kit), and the two resolve a `file:` URL by different rules — SQLite
 * only treats it as a URI when URI handling is on, drizzle-kit hands the string
 * to its own driver. One string can therefore name two different files, which
 * stays invisible until a query hits the empty one. Collapsing the URL to a
 * plain path here is what keeps every caller on the same file.
 *
 * Kept free of `bun:sqlite` imports so `drizzle.config.ts` can use it: that
 * config is bundled by drizzle-kit, which cannot resolve Bun's builtins.
 */
export function resolveDatabasePath(url: string): string {
  if (url.startsWith("file://")) {
    return fileURLToPath(url);
  }

  if (url.startsWith("file:")) {
    return url.slice("file:".length);
  }

  return url;
}
