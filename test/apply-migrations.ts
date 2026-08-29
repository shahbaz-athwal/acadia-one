import { Database as SqliteClient } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";

const MIGRATIONS_DIR = `${import.meta.dir}/../drizzle`;

/**
 * Builds the current schema in memory straight from `drizzle/`, so schema-shape
 * tests fail on the migration that introduces a problem rather than on whatever
 * happens to be in someone's local.db.
 */
export function migratedClient(): SqliteClient {
  const client = new SqliteClient(":memory:");

  const directories = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    // Timestamp-prefixed, so lexicographic order is migration order. `toSorted`
    // would be cleaner but tsconfig's `lib` stops at ES2022.
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort();

  for (const directory of directories) {
    const sql = readFileSync(
      `${MIGRATIONS_DIR}/${directory}/migration.sql`,
      "utf-8"
    );

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim().length > 0) {
        client.run(statement);
      }
    }
  }

  return client;
}
