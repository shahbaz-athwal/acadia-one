import { desc } from "drizzle-orm";

import type { Database } from "@/db";
import { adminAuditLog } from "@/db/schema";
import type { AdminAuditDetails } from "@/db/schema";

/**
 * Narrow enough that a drizzle transaction satisfies it, so an audit row can be
 * written inside the same transaction as the change it describes.
 */
type AuditWriter = Pick<Database, "insert">;

interface AdminAuditEntry {
  readonly action: string;
  readonly actorIp: string | null;
  readonly after?: AdminAuditDetails;
  readonly before?: AdminAuditDetails;
  readonly summary: string;
  readonly target?: string;
}

export function recordAdminAction(
  database: AuditWriter,
  entry: AdminAuditEntry,
  recordedAt: Date = new Date()
) {
  database
    .insert(adminAuditLog)
    .values({
      action: entry.action,
      actorIp: entry.actorIp,
      after: entry.after ?? null,
      before: entry.before ?? null,
      createdAt: recordedAt,
      summary: entry.summary,
      target: entry.target ?? null,
    })
    .run();
}

export function listAdminAuditEntries(database: Database, limit: number) {
  return database
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}
