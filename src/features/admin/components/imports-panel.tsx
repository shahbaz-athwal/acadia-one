import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, KeyRoundIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportRunKind, ImportRunStatus } from "@/db/schema";
import { getImportRuns, triggerImport } from "@/features/admin/api/imports";
import { getAdminOverview } from "@/features/admin/api/overview";
import { AdminErrorAlert } from "@/features/admin/components/admin-error-alert";
import {
  formatCounts,
  formatDateTime,
  formatDuration,
} from "@/features/admin/components/formatters";
import { adminQueryKeys } from "@/features/admin/components/query-keys";

const ACTIVE_POLL_INTERVAL_MS = 3000;
const PERCENT = 100;

const KIND_LABELS: Record<ImportRunKind, string> = {
  courses: "Course import",
  sectionDetails: "Section import",
};

const STATUS_VARIANTS: Record<ImportRunStatus, "info" | "success" | "error"> = {
  failed: "error",
  running: "info",
  succeeded: "success",
};

export const ImportsPanel = () => {
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryFn: async () => await getAdminOverview(),
    queryKey: adminQueryKeys.overview,
  });

  const runsQuery = useQuery({
    queryFn: async () => await getImportRuns(),
    queryKey: adminQueryKeys.importRuns,
    refetchInterval: (query) =>
      query.state.data?.activeRun ? ACTIVE_POLL_INTERVAL_MS : false,
  });

  const triggerMutation = useMutation({
    mutationFn: async (kind: ImportRunKind) =>
      await triggerImport({ data: { kind } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  const activeRun = runsQuery.data?.activeRun ?? null;
  const credentialsMissing =
    overviewQuery.data?.acadiaCredentialsConfigured === false;
  const progress = activeRun?.progress ?? null;

  return (
    <div className="flex flex-col gap-4">
      {credentialsMissing && (
        <Alert variant="warning">
          <KeyRoundIcon />
          <AlertTitle>Portal credentials are not configured</AlertTitle>
          <AlertDescription>
            Set ACADIA_ADMIN_USERNAME and ACADIA_ADMIN_PASSWORD before starting
            an import.
          </AlertDescription>
        </Alert>
      )}

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Run an import</CardTitle>
          <CardDescription>
            Terms and sections come from the Acadia portal. A full section
            import is roughly 1200 sequential portal requests and runs in the
            background — leaving this page does not stop it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={activeRun !== null || triggerMutation.isPending}
              onClick={() => {
                triggerMutation.mutate("sectionDetails");
              }}
              size="sm"
            >
              <DownloadIcon />
              Run section import
            </Button>
            <Button
              disabled={activeRun !== null || triggerMutation.isPending}
              onClick={() => {
                triggerMutation.mutate("courses");
              }}
              size="sm"
              variant="outline"
            >
              <DownloadIcon />
              Run course import
            </Button>
          </div>

          {triggerMutation.isError && (
            <p className="text-destructive-foreground text-sm">
              {triggerMutation.error.message}
            </p>
          )}

          {activeRun !== null && (
            <div className="flex flex-col gap-2 rounded-xl border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Spinner />
                <span className="font-medium">
                  {KIND_LABELS[activeRun.kind]} in progress
                </span>
              </div>
              {progress === null ? (
                <p className="text-muted-foreground text-xs">
                  Signing in to the portal…
                </p>
              ) : (
                <>
                  <Progress
                    value={
                      progress.totalCourses === 0
                        ? 0
                        : (progress.completedCourses / progress.totalCourses) *
                          PERCENT
                    }
                  />
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {progress.completedCourses} / {progress.totalCourses}{" "}
                    courses
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Run history</CardTitle>
          <CardDescription>
            Every run records what it touched, so a partial or failed run leaves
            a trace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runsQuery.isPending && <Skeleton className="h-24 rounded-xl" />}

          {runsQuery.isError && (
            <AdminErrorAlert
              error={runsQuery.error}
              title="Could not load run history"
            />
          )}

          {runsQuery.data !== undefined && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsQuery.data.runs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="text-muted-foreground text-sm"
                      colSpan={6}
                    >
                      No imports have been recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  runsQuery.data.runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{KIND_LABELS[run.kind]}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[run.status]}>
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {run.trigger}
                      </TableCell>
                      <TableCell>{formatDateTime(run.startedAt)}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatDuration(
                          run.startedAt,
                          run.status === "running" ? new Date() : run.finishedAt
                        )}
                      </TableCell>
                      <TableCell className="max-w-80 whitespace-normal text-xs">
                        {run.errorMessage ?? formatCounts(run.counts)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
