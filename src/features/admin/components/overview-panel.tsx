import { useQuery } from "@tanstack/react-query";
import { KeyRoundIcon, ShieldAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { getAdminOverview } from "@/features/admin/api/overview";
import { AdminErrorAlert } from "@/features/admin/components/admin-error-alert";
import {
  formatBytes,
  formatDateTime,
  formatNumber,
} from "@/features/admin/components/formatters";
import { adminQueryKeys } from "@/features/admin/components/query-keys";

const SKELETON_CARDS = ["a", "b", "c", "d", "e", "f"];

interface HealthRow {
  readonly hint: string;
  readonly label: string;
  readonly tone: "default" | "warning";
  readonly value: string;
}

export const OverviewPanel = () => {
  const overviewQuery = useQuery({
    queryFn: async () => await getAdminOverview(),
    queryKey: adminQueryKeys.overview,
  });

  if (overviewQuery.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SKELETON_CARDS.map((key) => (
          <Skeleton className="h-24 rounded-2xl" key={key} />
        ))}
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <AdminErrorAlert
        error={overviewQuery.error}
        title="Could not load the overview"
      />
    );
  }

  const { acadiaCredentialsConfigured, health, tableCounts } =
    overviewQuery.data;
  const healthRows: HealthRow[] = [
    {
      hint: "course_matching_sections rows with no importedAt; the next section import will visit these.",
      label: "Pending section imports",
      tone: health.pendingSectionImports > 0 ? "warning" : "default",
      value: formatNumber(health.pendingSectionImports),
    },
    {
      hint: "Most recent importedAt across course_matching_sections.",
      label: "Last course imported at",
      tone: "default",
      value: formatDateTime(health.lastCourseImportAt),
    },
    {
      hint: "Courses with no rows in sections. Expected for courses Acadia is not currently offering.",
      label: "Courses with zero sections",
      tone: "default",
      value: formatNumber(health.coursesWithoutSections),
    },
    {
      hint: "Professors that have never been matched to a Rate My Professors profile.",
      label: "Professors without an rmpId",
      tone: "default",
      value: formatNumber(health.professorsWithoutRmpId),
    },
    {
      hint: "Reviews kept without a course link, because the student-typed course code did not resolve. Expected; linking is an enrichment, not a filter.",
      label: "Reviews without a course link",
      tone: "default",
      value: formatNumber(health.ratingsWithoutCourse),
    },
    {
      hint: "Professors whose last RMP review pull failed. They are retried on the next run.",
      label: "Failed RMP review pulls",
      tone: health.failedRatingPulls > 0 ? "warning" : "default",
      value: formatNumber(health.failedRatingPulls),
    },
    {
      hint: "Most recent finishedAt across professor_rating_pulls.",
      label: "Last RMP review pull at",
      tone: "default",
      value: formatDateTime(health.lastRatingPullAt),
    },
    {
      hint: "section_professors declares no foreign keys, so these rows are never cleaned up automatically.",
      label: "Orphaned section_professors rows",
      tone: health.orphanedSectionProfessors > 0 ? "warning" : "default",
      value: formatNumber(health.orphanedSectionProfessors),
    },
    {
      hint: "PRAGMA foreign_keys on this connection. SQLite defaults it to OFF per connection.",
      label: "Foreign key enforcement",
      tone: health.foreignKeysEnabled ? "default" : "warning",
      value: health.foreignKeysEnabled ? "On" : "Off",
    },
    {
      hint: "Rows reported by PRAGMA foreign_key_check.",
      label: "Foreign key violations",
      tone: health.foreignKeyViolations > 0 ? "warning" : "default",
      value: formatNumber(health.foreignKeyViolations),
    },
    {
      hint: "page_count * page_size.",
      label: "Database size",
      tone: "default",
      value: formatBytes(health.databaseBytes),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {!acadiaCredentialsConfigured && (
        <Alert variant="warning">
          <KeyRoundIcon />
          <AlertTitle>Portal credentials are not configured</AlertTitle>
          <AlertDescription>
            ACADIA_ADMIN_USERNAME and ACADIA_ADMIN_PASSWORD are unset, so
            imports cannot run from this process.
          </AlertDescription>
        </Alert>
      )}

      {!health.foreignKeysEnabled && (
        <Alert variant="error">
          <ShieldAlertIcon />
          <AlertTitle>Foreign keys are not enforced</AlertTitle>
          <AlertDescription>
            This connection did not apply PRAGMA foreign_keys = ON, so
            sections.termCode is unchecked.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tableCounts.map((entry) => (
          <Card className="gap-2 py-4" key={entry.table}>
            <CardHeader className="px-4">
              <CardDescription className="font-mono text-xs">
                {entry.table}
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatNumber(entry.rows)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-muted-foreground text-xs">
              {entry.label}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Operational health</CardTitle>
          <CardDescription>
            Signals that raw row counts do not surface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Signal</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {healthRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="whitespace-normal">
                    <span className="font-medium">{row.label}</span>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      {row.hint}
                    </p>
                  </TableCell>
                  <TableCell className="text-right align-top">
                    {row.tone === "warning" ? (
                      <Badge variant="warning">{row.value}</Badge>
                    ) : (
                      <span className="tabular-nums">{row.value}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
