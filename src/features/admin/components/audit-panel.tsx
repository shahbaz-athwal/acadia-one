import { useQuery } from "@tanstack/react-query";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuditLog } from "@/features/admin/api/audit";
import { AdminErrorAlert } from "@/features/admin/components/admin-error-alert";
import { formatDateTime } from "@/features/admin/components/formatters";
import { adminQueryKeys } from "@/features/admin/components/query-keys";

const JSON_INDENT = 2;

export const AuditPanel = () => {
  const auditQuery = useQuery({
    queryFn: async () => await getAuditLog(),
    queryKey: adminQueryKeys.auditLog,
  });

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>
          Every admin write, with a before/after snapshot. The 100 most recent
          entries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {auditQuery.isPending && <Skeleton className="h-24 rounded-xl" />}

        {auditQuery.isError && (
          <AdminErrorAlert
            error={auditQuery.error}
            title="Could not load the audit log"
          />
        )}

        {auditQuery.data !== undefined && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditQuery.data.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="text-muted-foreground text-sm"
                    colSpan={4}
                  >
                    Nothing has been recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                auditQuery.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.action}
                    </TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-xs">
                      {entry.target ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-96 whitespace-normal">
                      {entry.summary}
                      {(entry.before ?? entry.after) !== null && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-muted-foreground text-xs">
                            Before / after
                          </summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                            {JSON.stringify(
                              { after: entry.after, before: entry.before },
                              null,
                              JSON_INDENT
                            )}
                          </pre>
                        </details>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
