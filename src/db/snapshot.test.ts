import { expect, test } from "bun:test";

import { migratedClient } from "../../test/apply-migrations";
import { applySnapshot, createSnapshot, listTables } from "./snapshot";
import { CATALOG_TABLE_NAMES } from "./tables";

function seedRows(client: ReturnType<typeof migratedClient>) {
  client.run(
    "INSERT INTO terms (termCode, name, startDate, endDate, archivedAt) VALUES ('202510', 'Fall 2025', 1, 2, NULL)"
  );
  // `departments` is already populated by the migrations, so MATH exists.
  client.run(
    `INSERT INTO professors (id, rmpId, rmpLegacyId, name, imageUrl, details) VALUES ('p1', NULL, NULL, 'O''Brien, Ann', NULL, '{"email":"a@b.c"}')`
  );
  client.run(
    "INSERT INTO professor_departments (professorId, departmentPrefix) VALUES ('p1', 'MATH')"
  );
}

test("round-trips catalog rows through a snapshot", () => {
  const source = migratedClient();
  const target = migratedClient();

  try {
    seedRows(source);

    const sql = createSnapshot(source);

    applySnapshot(target, sql);

    const professor = target
      .query<{ name: string; details: string }, []>(
        "SELECT name, details FROM professors WHERE id = 'p1'"
      )
      .get();

    expect(professor?.name).toBe("O'Brien, Ann");
    expect(professor?.details).toBe('{"email":"a@b.c"}');
    expect(
      target.query<{ n: number }, []>("SELECT count(*) AS n FROM terms").get()
        ?.n
    ).toBe(1);
  } finally {
    source.close();
    target.close();
  }
});

test("seeding is idempotent and clears rows the snapshot does not have", () => {
  const source = migratedClient();
  const target = migratedClient();

  try {
    seedRows(source);
    seedRows(target);
    target.run(
      "INSERT INTO terms (termCode, name, startDate, endDate, archivedAt) VALUES ('209910', 'Stale', 1, 2, NULL)"
    );

    const sql = createSnapshot(source);

    applySnapshot(target, sql);
    applySnapshot(target, sql);

    const terms = target
      .query<{ termCode: string }, []>("SELECT termCode FROM terms")
      .all();

    expect(terms.map((row) => row.termCode)).toEqual(["202510"]);
  } finally {
    source.close();
    target.close();
  }
});

test("a snapshot never mentions an operational or user table", () => {
  const client = migratedClient();

  try {
    const sql = createSnapshot(client);

    expect(sql).not.toContain("import_runs");
    expect(sql).not.toContain("admin_audit_log");

    for (const table of CATALOG_TABLE_NAMES) {
      expect(sql).toContain(`DELETE FROM "${table}";`);
    }
  } finally {
    client.close();
  }
});

test("refuses to snapshot a database with an unclassified table", () => {
  const client = migratedClient();

  try {
    client.run("CREATE TABLE users (id text PRIMARY KEY, email text NOT NULL)");

    expect(listTables(client)).toContain("users");
    expect(() => createSnapshot(client)).toThrow(
      /Unclassified table\(s\): users/u
    );
  } finally {
    client.close();
  }
});
