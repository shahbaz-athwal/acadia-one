import { Database as SQLiteDatabase } from "bun:sqlite";
import { expect, test } from "bun:test";

import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { adminAuditLog, terms } from "@/db/schema";

import {
  createAdminTerm,
  listAdminTerms,
  previewTermArchive,
  setTermsArchived,
} from "./terms";

const NOW = new Date("2026-08-26T12:00:00.000Z");

function createTestDatabase() {
  const sqlite = new SQLiteDatabase(":memory:");

  sqlite.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE terms (
      termCode text PRIMARY KEY,
      name text NOT NULL,
      endDate integer NOT NULL,
      startDate integer NOT NULL,
      archivedAt integer
    );
    CREATE TABLE sections (
      id text NOT NULL,
      termCode text NOT NULL REFERENCES terms(termCode),
      courseId text NOT NULL,
      sectionCode text NOT NULL,
      sectionSearchName text NOT NULL,
      classStart integer,
      classEnd integer,
      buildingName text,
      roomNumber text,
      room text,
      showTBD integer NOT NULL,
      days text NOT NULL,
      isOnline integer NOT NULL
    );
    CREATE TABLE admin_audit_log (
      id text PRIMARY KEY,
      action text NOT NULL,
      target text,
      summary text NOT NULL,
      before text,
      after text,
      createdAt integer NOT NULL
    );
  `);

  return { database: drizzle({ client: sqlite, jit: true }), sqlite };
}

function seed(database: ReturnType<typeof createTestDatabase>["database"]) {
  database
    .insert(terms)
    .values([
      {
        endDate: new Date("2026-04-20T00:00:00.000Z"),
        name: "Winter 2026",
        startDate: new Date("2026-01-05T00:00:00.000Z"),
        termCode: "2026WI",
      },
      {
        endDate: new Date("2026-12-20T00:00:00.000Z"),
        name: "Fall 2026",
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        termCode: "2026FA",
      },
    ])
    .run();
}

function insertSection(
  database: ReturnType<typeof createTestDatabase>["database"],
  id: string,
  termCode: string,
  courseId: string
) {
  database.$client
    .query(
      `INSERT INTO sections
        (id, termCode, courseId, sectionCode, sectionSearchName, showTBD, days, isOnline)
        VALUES (?, ?, ?, '01', 'X', 0, '[]', 0)`
    )
    .run(id, termCode, courseId);
}

test("flags ended terms as ready to archive and counts their sections", async () => {
  const { database, sqlite } = createTestDatabase();

  try {
    seed(database);
    insertSection(database, "s1", "2026WI", "c1");
    insertSection(database, "s2", "2026WI", "c2");
    insertSection(database, "s3", "2026FA", "c1");

    const rows = await listAdminTerms(database, NOW);

    expect(rows.map((row) => row.termCode)).toEqual(["2026WI", "2026FA"]);
    expect(rows[0]).toMatchObject({
      courseCount: 2,
      isReadyToArchive: true,
      sectionCount: 2,
    });
    expect(rows[1]).toMatchObject({
      courseCount: 1,
      isReadyToArchive: false,
      sectionCount: 1,
    });
  } finally {
    sqlite.close();
  }
});

test("previews the blast radius before archiving", async () => {
  const { database, sqlite } = createTestDatabase();

  try {
    seed(database);
    insertSection(database, "s1", "2026WI", "c1");
    insertSection(database, "s2", "2026WI", "c1");

    const preview = await previewTermArchive(database, ["2026WI", "nope"]);

    expect(preview).toEqual({
      courseCount: 1,
      missingTermCodes: ["nope"],
      sectionCount: 2,
      termCodes: ["2026WI"],
    });
  } finally {
    sqlite.close();
  }
});

test("archives and unarchives terms without deleting anything", async () => {
  const { database, sqlite } = createTestDatabase();

  try {
    seed(database);
    insertSection(database, "s1", "2026WI", "c1");

    const archived = await setTermsArchived(
      database,
      { archived: true, termCodes: ["2026WI", "2026FA"] },
      NOW
    );

    expect(archived.changedTermCodes).toHaveLength(2);
    expect(archived.changedTermCodes).toContain("2026WI");
    expect(archived.changedTermCodes).toContain("2026FA");

    const afterArchive = database
      .select()
      .from(terms)
      .orderBy(asc(terms.termCode))
      .all();
    expect(afterArchive.every((row) => row.archivedAt !== null)).toBe(true);
    expect(database.$client.query("SELECT * FROM sections").all()).toHaveLength(
      1
    );

    // Re-archiving is a no-op rather than a second audit entry.
    const again = await setTermsArchived(
      database,
      { archived: true, termCodes: ["2026WI"] },
      NOW
    );
    expect(again.changedTermCodes).toEqual([]);

    const unarchived = await setTermsArchived(
      database,
      { archived: false, termCodes: ["2026WI"] },
      NOW
    );
    expect(unarchived.changedTermCodes).toEqual(["2026WI"]);

    const entries = database
      .select()
      .from(adminAuditLog)
      .orderBy(asc(adminAuditLog.action))
      .all();
    expect(entries.map((entry) => entry.action)).toEqual([
      "terms.archive",
      "terms.unarchive",
    ]);
    expect(entries[0]?.before).toBeTruthy();
  } finally {
    sqlite.close();
  }
});

test("rejects a duplicate hand-created term", async () => {
  const { database, sqlite } = createTestDatabase();

  try {
    seed(database);

    await createAdminTerm(
      database,
      {
        endDate: new Date("2027-04-20T00:00:00.000Z"),
        name: "Winter 2027",
        startDate: new Date("2027-01-05T00:00:00.000Z"),
        termCode: "2027WI",
      },
      NOW
    );

    expect(
      database
        .select()
        .from(terms)
        .all()
        .map((row) => row.termCode)
    ).toContain("2027WI");

    let duplicateError: unknown;

    try {
      await createAdminTerm(
        database,
        {
          endDate: new Date("2027-04-20T00:00:00.000Z"),
          name: "Winter 2027 again",
          startDate: new Date("2027-01-05T00:00:00.000Z"),
          termCode: "2027WI",
        },
        NOW
      );
    } catch (error) {
      duplicateError = error;
    }

    expect(duplicateError).toBeInstanceOf(Error);
    expect(
      duplicateError instanceof Error ? duplicateError.message : ""
    ).toContain("already exists");
  } finally {
    sqlite.close();
  }
});
