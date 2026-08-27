import { createServerFn } from "@tanstack/react-start";

import { getDatabase } from "@/db";
import {
  areAcadiaCredentialsConfigured,
  failInterruptedRuns,
  getActiveRun,
} from "@/server/admin/import-runner";
import { adminMiddleware } from "@/server/admin/middleware";
import { getHealthSignals, getTableCounts } from "@/server/admin/overview";

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const database = getDatabase();

    failInterruptedRuns(database);

    return {
      acadiaCredentialsConfigured: areAcadiaCredentialsConfigured(),
      activeRun: getActiveRun(),
      health: await getHealthSignals(database),
      tableCounts: await getTableCounts(database),
    };
  });
