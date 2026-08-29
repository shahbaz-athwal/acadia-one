import { expect, test } from "bun:test";

import { migratedClient } from "../../test/apply-migrations";
import { listTables } from "./snapshot";
import {
  CATALOG_TABLE_NAMES,
  classifyTable,
  findUnclassifiedTables,
  isInternalTable,
  OPERATIONAL_TABLE_NAMES,
  USER_TABLE_NAMES,
} from "./tables";

test("every table in the migrated schema is classified", () => {
  const client = migratedClient();

  try {
    expect(findUnclassifiedTables(listTables(client))).toEqual([]);
  } finally {
    client.close();
  }
});

test("every classified table exists in the migrated schema", () => {
  const client = migratedClient();

  try {
    const existing = new Set(listTables(client));
    const classified = [
      ...CATALOG_TABLE_NAMES,
      ...OPERATIONAL_TABLE_NAMES,
      ...USER_TABLE_NAMES,
    ];

    expect(classified.filter((name) => !existing.has(name))).toEqual([]);
  } finally {
    client.close();
  }
});

test("a table is classified exactly once", () => {
  const classified = [
    ...CATALOG_TABLE_NAMES,
    ...OPERATIONAL_TABLE_NAMES,
    ...USER_TABLE_NAMES,
  ];

  expect(classified).toHaveLength(new Set(classified).size);
});

test("user and operational tables are never catalog", () => {
  for (const name of [...OPERATIONAL_TABLE_NAMES, ...USER_TABLE_NAMES]) {
    expect(CATALOG_TABLE_NAMES).not.toContain(name);
    expect(classifyTable(name)).not.toBe("catalog");
  }
});

test("drizzle and sqlite bookkeeping is treated as internal", () => {
  expect(isInternalTable("__drizzle_migrations")).toBe(true);
  expect(isInternalTable("sqlite_sequence")).toBe(true);
  expect(isInternalTable("courses")).toBe(false);
});
