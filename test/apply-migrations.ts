import { Database as SqliteClient } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const MIGRATIONS_DIR = `${import.meta.dir}/../drizzle`;

/**
 * Builds the current schema in memory straight from `drizzle/`, so schema-shape
 * tests fail on the migration that introduces a problem rather than on whatever
 * happens to be in someone's local.db.
 */
export function migratedClient(): SqliteClient {
  const client = new SqliteClient(":memory:");

  const files = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${MIGRATIONS_DIR}/${entry.name}/migration.sql`)
    // Deleting a generated migration leaves its directory behind, and git does
    // not track empty directories — so a checkout can hold folders drizzle
    // skips. Skip them here too rather than blowing up on a stale leftover.
    .filter((file) => existsSync(file))
    // Timestamp-prefixed, so lexicographic order is migration order. `toSorted`
    // would be cleaner but tsconfig's `lib` stops at ES2022.
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort();

  for (const file of files) {
    const sql = readFileSync(file, "utf-8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim().length > 0) {
        client.run(statement);
      }
    }
  }

  return client;
}
