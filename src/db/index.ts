import { Database as SqliteClient } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import nodePath from "node:path";

import { drizzle } from "drizzle-orm/bun-sqlite";

import { DEFAULT_DATABASE_URL, resolveDatabasePath } from "./path";

/**
 * SQLite disables foreign key enforcement per connection, so `sections.termCode
 * -> terms.termCode` and the other declared references are only checked once
 * this pragma runs. It has to be issued on every connection we open.
 */
export function enableForeignKeys(client: SqliteClient) {
  client.run("PRAGMA foreign_keys = ON");
}

export function createDatabase(
  url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
) {
  const databasePath = resolveDatabasePath(url);

  // SQLite reports a missing parent directory as the same opaque "unable to open
  // database file" it uses for a permissions problem. The deployed database
  // lives on a mounted volume, so create the directory rather than make an
  // operator guess which of the two they are looking at.
  if (databasePath !== ":memory:") {
    mkdirSync(nodePath.dirname(databasePath), { recursive: true });
  }

  const client = new SqliteClient(databasePath, {
    create: true,
    readwrite: true,
  });

  enableForeignKeys(client);

  return drizzle({ client, jit: true });
}

export type Database = ReturnType<typeof createDatabase>;

let defaultDatabase: Database | undefined;

/**
 * Opening the connection lazily keeps `import`ing a workflow from creating a
 * stray `local.db` in whatever directory the process happens to start in.
 * Prefer passing an explicit database into workflows; this is the fallback for
 * request handlers that want the process-wide connection.
 */
export function getDatabase(): Database {
  defaultDatabase ??= createDatabase();

  return defaultDatabase;
}
