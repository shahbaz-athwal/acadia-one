import { and, desc, eq, ne } from "drizzle-orm";

import type { Database } from "@/db";
import { importRuns } from "@/db/schema";
import type { ImportRunKind, ImportRunTrigger } from "@/db/schema";
import { authenticateAcadiaStudent } from "@/server/acadia/auth";
import { AcadiaExtractor } from "@/server/acadia/extractor";
import { recordAdminAction } from "@/server/admin/audit";
import { importCourses } from "@/server/workflows/courses";
import { importProfessors } from "@/server/workflows/professors";
import type { ImportProgress } from "@/server/workflows/progress";
import { importRmpRatings } from "@/server/workflows/rmp-ratings";
import { importSectionDetails } from "@/server/workflows/sections";

interface ActiveRun {
  readonly id: string;
  readonly kind: ImportRunKind;
  progress: ImportProgress | null;
}

/**
 * In-process handle on the run currently executing. It is deliberately not
 * persisted: a restart loses it, which is exactly the signal
 * `failInterruptedRuns` uses to close out rows left in `running`.
 */
let activeRun: ActiveRun | undefined;

export function getActiveRun() {
  if (activeRun === undefined) {
    return null;
  }

  return {
    id: activeRun.id,
    kind: activeRun.kind,
    progress: activeRun.progress,
  };
}

export function areAcadiaCredentialsConfigured() {
  const username = process.env.ACADIA_ADMIN_USERNAME;
  const password = process.env.ACADIA_ADMIN_PASSWORD;

  return (
    typeof username === "string" &&
    username.length > 0 &&
    typeof password === "string" &&
    password.length > 0
  );
}

/**
 * A run row only ever leaves `running` from this process. If the server was
 * restarted mid-import the row is stranded, so close it out before deciding
 * whether a new run may start.
 */
export function failInterruptedRuns(
  database: Database,
  now: Date = new Date()
) {
  const stillRunning = eq(importRuns.status, "running");
  const where =
    activeRun === undefined
      ? stillRunning
      : and(stillRunning, ne(importRuns.id, activeRun.id));

  database
    .update(importRuns)
    .set({
      errorMessage:
        "The server restarted while this run was in progress; the result is unknown.",
      finishedAt: now,
      status: "failed",
    })
    .where(where)
    .run();
}

export function listImportRuns(database: Database, limit: number) {
  return database
    .select()
    .from(importRuns)
    .orderBy(desc(importRuns.startedAt))
    .limit(limit);
}

async function createExtractor() {
  const username = process.env.ACADIA_ADMIN_USERNAME;
  const password = process.env.ACADIA_ADMIN_PASSWORD;

  if (!(username && password)) {
    throw new Error(
      "ACADIA_ADMIN_USERNAME and ACADIA_ADMIN_PASSWORD must be set to run an import."
    );
  }

  const cookiesResult = await authenticateAcadiaStudent(username, password);

  if (cookiesResult.isErr()) {
    throw new Error(
      `Could not sign in to the Acadia portal: ${cookiesResult.error.message}`,
      { cause: cookiesResult.error }
    );
  }

  return new AcadiaExtractor(cookiesResult.value);
}

/**
 * A run degraded rather than failed — some professors did not import, or the
 * roster lookup that drives skipping was unavailable — is still recorded as
 * succeeded, because most of it did work. The audit log is where that nuance
 * lives, so a half-empty run is never silently indistinguishable from a clean
 * one.
 */
function auditRmpRatingsRun(
  database: Database,
  run: ActiveRun,
  report: Awaited<ReturnType<typeof importRmpRatings>>
) {
  const failures = report.professors.filter(
    (professor) => professor.status === "failed"
  );

  if (failures.length === 0 && report.rosterWarning === null) {
    return;
  }

  recordAdminAction(database, {
    action: "imports.rmpRatings.degraded",
    after: {
      failedProfessors: failures.map((professor) => ({
        error: professor.errorMessage,
        professor: professor.professorName,
      })),
      rosterWarning: report.rosterWarning,
    },
    summary:
      failures.length === 0
        ? "RMP review import could not read the roster, so nothing was skipped."
        : `RMP review import finished with ${failures.length} professor(s) failing.`,
    target: run.id,
  });
}

async function executeRun(database: Database, run: ActiveRun) {
  const onProgress = (progress: ImportProgress) => {
    run.progress = progress;
  };

  // Cases are exhaustive over `ImportRunKind`, so adding a kind to
  // `IMPORT_RUN_KINDS` fails to compile until it is dispatched here.
  switch (run.kind) {
    case "courses": {
      return await importCourses({
        database,
        extractor: await createExtractor(),
      });
    }
    case "professors": {
      return await importProfessors({
        database,
        extractor: await createExtractor(),
      });
    }
    case "sectionDetails": {
      return await importSectionDetails({
        database,
        extractor: await createExtractor(),
        onProgress,
      });
    }
    case "rmpRatings": {
      // Rate My Professors is public, so this is the one import that needs no
      // portal credentials — `createExtractor` is deliberately not called.
      const report = await importRmpRatings({
        database,
        onProgress,
        runId: run.id,
      });

      auditRmpRatingsRun(database, run, report);

      return report.counts;
    }
    default: {
      // `import_runs.kind` is an unconstrained text column, so a hand-edited
      // row can hold something this process has never heard of.
      throw new Error(`Unknown import kind: ${String(run.kind)}`);
    }
  }
}

async function finishRun(database: Database, run: ActiveRun) {
  try {
    const counts = await executeRun(database, run);

    database
      .update(importRuns)
      .set({ counts, finishedAt: new Date(), status: "succeeded" })
      .where(eq(importRuns.id, run.id))
      .run();
  } catch (error) {
    database
      .update(importRuns)
      .set({
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
        status: "failed",
      })
      .where(eq(importRuns.id, run.id))
      .run();
  } finally {
    if (activeRun?.id === run.id) {
      activeRun = undefined;
    }
  }
}

interface StartImportRunOptions {
  readonly kind: ImportRunKind;
  readonly trigger: ImportRunTrigger;
}

/**
 * Starts an import and returns as soon as the run row exists. A full section
 * import is roughly 1200 sequential portal requests, so it deliberately
 * outlives the request that triggered it; callers poll `listImportRuns`.
 */
export function startImportRun(
  database: Database,
  { kind, trigger }: StartImportRunOptions,
  now: Date = new Date()
) {
  if (activeRun !== undefined) {
    throw new Error(
      `An import (${activeRun.kind}) is already running. Wait for it to finish.`
    );
  }

  failInterruptedRuns(database, now);

  const [inserted] = database
    .insert(importRuns)
    .values({ kind, startedAt: now, status: "running", trigger })
    .returning({ id: importRuns.id })
    .all();

  if (inserted === undefined) {
    throw new Error("Could not record the import run.");
  }

  const run: ActiveRun = { id: inserted.id, kind, progress: null };

  activeRun = run;

  // Deliberately not awaited: the run has to outlive the request that started
  // it. `finishRun` swallows and persists its own failures, so this never
  // rejects.
  void finishRun(database, run);

  return { runId: run.id };
}
