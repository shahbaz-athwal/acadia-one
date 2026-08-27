import { expect, test } from "bun:test";

import { createDatabase } from "./index";

test("enables foreign key enforcement on the connection", () => {
  const database = createDatabase(":memory:");

  try {
    const pragma = database.$client
      .query<{ foreign_keys: number }, []>("PRAGMA foreign_keys")
      .get();

    expect(pragma?.foreign_keys).toBe(1);

    database.$client.run(`
      CREATE TABLE parents (id text PRIMARY KEY);
      CREATE TABLE children (
        id text PRIMARY KEY,
        parentId text NOT NULL REFERENCES parents(id)
      );
    `);

    expect(() => {
      database.$client.run(
        "INSERT INTO children (id, parentId) VALUES ('a', 'missing')"
      );
    }).toThrow();
  } finally {
    database.$client.close();
  }
});
