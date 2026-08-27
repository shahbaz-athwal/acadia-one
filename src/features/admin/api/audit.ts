import { createServerFn } from "@tanstack/react-start";

import { getDatabase } from "@/db";
import { listAdminAuditEntries } from "@/server/admin/audit";
import { adminMiddleware } from "@/server/admin/middleware";

const AUDIT_LIMIT = 100;

export const getAuditLog = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => await listAdminAuditEntries(getDatabase(), AUDIT_LIMIT));
