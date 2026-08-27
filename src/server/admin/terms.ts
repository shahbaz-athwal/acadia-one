import { asc, countDistinct, eq, inArray } from "drizzle-orm";

import type { Database } from "@/db";
import { sections, terms } from "@/db/schema";
import { recordAdminAction } from "@/server/admin/audit";

export interface AdminTermRow {
  readonly archivedAt: Date | null;
  readonly courseCount: number;
  readonly endDate: Date;
  readonly isReadyToArchive: boolean;
  readonly name: string;
  readonly sectionCount: number;
  readonly startDate: Date;
  readonly termCode: string;
}

interface TermArchivePreview {
  readonly courseCount: number;
  readonly missingTermCodes: string[];
  readonly sectionCount: number;
  readonly termCodes: string[];
}

export async function listAdminTerms(
  database: Database,
  now: Date = new Date()
): Promise<AdminTermRow[]> {
  const rows = await database
    .select({
      archivedAt: terms.archivedAt,
      courseCount: countDistinct(sections.courseId),
      endDate: terms.endDate,
      name: terms.name,
      sectionCount: countDistinct(sections.id),
      startDate: terms.startDate,
      termCode: terms.termCode,
    })
    .from(terms)
    .leftJoin(sections, eq(sections.termCode, terms.termCode))
    .groupBy(terms.termCode)
    .orderBy(asc(terms.startDate), asc(terms.termCode));

  return rows.map((row) => ({
    ...row,
    isReadyToArchive:
      row.archivedAt === null && row.endDate.getTime() < now.getTime(),
  }));
}

/**
 * Dry-run counts for the confirmation dialog: archiving hides these sections
 * from the student UI, so the operator should see the blast radius first.
 */
export async function previewTermArchive(
  database: Database,
  termCodes: string[]
): Promise<TermArchivePreview> {
  if (termCodes.length === 0) {
    return {
      courseCount: 0,
      missingTermCodes: [],
      sectionCount: 0,
      termCodes: [],
    };
  }

  const foundTerms = await database
    .select({ termCode: terms.termCode })
    .from(terms)
    .where(inArray(terms.termCode, termCodes));
  const foundTermCodes = foundTerms.map(({ termCode }) => termCode);
  const [totals] = await database
    .select({
      courseCount: countDistinct(sections.courseId),
      sectionCount: countDistinct(sections.id),
    })
    .from(sections)
    .where(inArray(sections.termCode, termCodes));

  return {
    courseCount: totals?.courseCount ?? 0,
    missingTermCodes: termCodes.filter(
      (termCode) => !foundTermCodes.includes(termCode)
    ),
    sectionCount: totals?.sectionCount ?? 0,
    termCodes: foundTermCodes,
  };
}

interface SetTermsArchivedOptions {
  readonly archived: boolean;
  readonly termCodes: string[];
}

/**
 * Archiving is a single UPDATE on `terms` — a section is archived iff its term
 * is. Nothing is deleted, so this is fully reversible.
 */
export async function setTermsArchived(
  database: Database,
  { archived, termCodes }: SetTermsArchivedOptions,
  now: Date = new Date()
) {
  if (termCodes.length === 0) {
    return { changedTermCodes: [] as string[], sectionCount: 0 };
  }

  const preview = await previewTermArchive(database, termCodes);
  const before = await database
    .select({ archivedAt: terms.archivedAt, termCode: terms.termCode })
    .from(terms)
    .where(inArray(terms.termCode, termCodes));
  const changedTermCodes = before
    .filter(({ archivedAt }) => (archivedAt === null) === archived)
    .map(({ termCode }) => termCode);

  if (changedTermCodes.length === 0) {
    return { changedTermCodes, sectionCount: preview.sectionCount };
  }

  database.transaction((transaction) => {
    transaction
      .update(terms)
      .set({ archivedAt: archived ? now : null })
      .where(inArray(terms.termCode, changedTermCodes))
      .run();

    recordAdminAction(
      transaction,
      {
        action: archived ? "terms.archive" : "terms.unarchive",
        after: {
          archivedAt: archived ? now.toISOString() : null,
          termCodes: changedTermCodes,
        },
        before: {
          terms: before.map(({ archivedAt, termCode }) => ({
            archivedAt: archivedAt?.toISOString() ?? null,
            termCode,
          })),
        },
        summary: `${archived ? "Archived" : "Unarchived"} ${changedTermCodes.length} term(s) covering ${preview.sectionCount} section(s).`,
        target: changedTermCodes.join(", "),
      },
      now
    );
  });

  return { changedTermCodes, sectionCount: preview.sectionCount };
}

interface CreateTermOptions {
  readonly endDate: Date;
  readonly name: string;
  readonly startDate: Date;
  readonly termCode: string;
}

/**
 * Escape hatch only. Terms are normally discovered by `importSectionDetails`
 * straight from the portal; a hand-typed `termCode` that does not match Acadia
 * creates a duplicate row the moment the real term arrives.
 */
export async function createAdminTerm(
  database: Database,
  { endDate, name, startDate, termCode }: CreateTermOptions,
  now: Date = new Date()
) {
  const existing = await database
    .select({ termCode: terms.termCode })
    .from(terms)
    .where(eq(terms.termCode, termCode));

  if (existing.length > 0) {
    throw new Error(`Term ${termCode} already exists.`);
  }

  database.transaction((transaction) => {
    transaction
      .insert(terms)
      .values({ endDate, name, startDate, termCode })
      .run();

    recordAdminAction(
      transaction,
      {
        action: "terms.create",
        after: {
          endDate: endDate.toISOString(),
          name,
          startDate: startDate.toISOString(),
          termCode,
        },
        summary: `Hand-created term ${termCode} (${name}).`,
        target: termCode,
      },
      now
    );
  });
}
