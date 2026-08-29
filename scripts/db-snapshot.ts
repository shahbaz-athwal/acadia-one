import { createDatabase } from "../src/db/index";
import { createSnapshot, SNAPSHOT_PATH } from "../src/db/snapshot";

const database = createDatabase();

try {
  const sql = createSnapshot(database.$client);

  await Bun.write(SNAPSHOT_PATH, sql);

  const rows = sql
    .split("\n")
    .filter((line) => line.startsWith("INSERT ")).length;

  process.stdout.write(
    `Wrote ${rows} rows to ${SNAPSHOT_PATH} (${(sql.length / 1_000_000).toFixed(1)} MB)\n`
  );
} finally {
  database.$client.close();
}
