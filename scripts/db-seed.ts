import { sql } from "drizzle-orm";

import { createDatabase } from "../src/db/index";
import { terms } from "../src/db/schema";
import { applySnapshot, SNAPSHOT_PATH } from "../src/db/snapshot";

/**
 * Container start runs this on every boot, so it needs a way to say "seed a
 * fresh volume, leave a populated one alone" — re-applying the snapshot would
 * otherwise discard catalog rows imported in production since the deploy.
 */
const onlyIfEmpty = process.argv.includes("--if-empty");

const snapshot = Bun.file(SNAPSHOT_PATH);

if (!(await snapshot.exists())) {
  process.stderr.write(
    `No snapshot at ${SNAPSHOT_PATH}. Run \`bun run db:snapshot\` against a database that has the catalog imported.\n`
  );
  process.exit(1);
}

const database = createDatabase();

try {
  // `terms` rather than "any catalog table has rows": migrations ship the
  // department list, so a freshly migrated database is never entirely empty.
  // Terms are importer-owned, so rows here mean a catalog actually landed.
  const importedTerms =
    database
      .select({ count: sql<number>`count(*)` })
      .from(terms)
      .get()?.count ?? 0;

  if (onlyIfEmpty && importedTerms > 0) {
    process.stdout.write(
      `Catalog already present (${importedTerms} terms), skipping seed\n`
    );
  } else {
    applySnapshot(database.$client, await snapshot.text());

    process.stdout.write(`Seeded catalog tables from ${SNAPSHOT_PATH}\n`);
  }
} finally {
  database.$client.close();
}
