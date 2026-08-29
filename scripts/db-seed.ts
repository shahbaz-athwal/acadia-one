import { createDatabase } from "../src/db/index";
import { applySnapshot, SNAPSHOT_PATH } from "../src/db/snapshot";

const snapshot = Bun.file(SNAPSHOT_PATH);

if (!(await snapshot.exists())) {
  process.stderr.write(
    `No snapshot at ${SNAPSHOT_PATH}. Run \`bun run db:snapshot\` against a database that has the catalog imported.\n`
  );
  process.exit(1);
}

const database = createDatabase();

try {
  applySnapshot(database.$client, await snapshot.text());

  process.stdout.write(`Seeded catalog tables from ${SNAPSHOT_PATH}\n`);
} finally {
  database.$client.close();
}
