import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getDatabase } from "@/db";
import { recordAdminAction } from "@/server/admin/audit";
import {
  failInterruptedRuns,
  getActiveRun,
  listImportRuns,
  startImportRun,
} from "@/server/admin/import-runner";
import { adminMiddleware } from "@/server/admin/middleware";

const IMPORT_RUN_LIMIT = 25;

export const getImportRuns = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const database = getDatabase();

    failInterruptedRuns(database);

    return {
      activeRun: getActiveRun(),
      runs: await listImportRuns(database, IMPORT_RUN_LIMIT),
    };
  });

export const triggerImport = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ kind: z.enum(["courses", "sectionDetails"]) }))
  .handler(({ data }) => {
    const database = getDatabase();
    const { runId } = startImportRun(database, {
      kind: data.kind,
      trigger: "admin-dashboard",
    });

    recordAdminAction(database, {
      action: "imports.start",
      after: { kind: data.kind, runId },
      summary: `Started a ${data.kind} import.`,
      target: runId,
    });

    return { runId };
  });
