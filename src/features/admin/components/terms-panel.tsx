import { useQuery } from "@tanstack/react-query";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalendarPlusIcon,
  DatabaseIcon,
} from "lucide-react";
import { useState } from "react";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listTerms } from "@/features/admin/api/terms";
import { AddTermDialog } from "@/features/admin/components/add-term-dialog";
import { AdminErrorAlert } from "@/features/admin/components/admin-error-alert";
import { ArchiveTermsDialog } from "@/features/admin/components/archive-terms-dialog";
import type { TermArchiveAction } from "@/features/admin/components/archive-terms-dialog";
import {
  formatDate,
  formatNumber,
} from "@/features/admin/components/formatters";
import { adminQueryKeys } from "@/features/admin/components/query-keys";
import type { AdminTermRow } from "@/server/admin/terms";

const SKELETON_ROWS = ["a", "b", "c"];

function statusBadge(term: AdminTermRow) {
  if (term.archivedAt !== null) {
    return <Badge variant="secondary">Archived</Badge>;
  }

  if (term.isReadyToArchive) {
    return <Badge variant="warning">Ready to archive</Badge>;
  }

  return <Badge variant="success">Active</Badge>;
}

export const TermsPanel = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<TermArchiveAction | null>(
    null
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const confirmAction = (action: TermArchiveAction) => {
    setPendingAction(action);
    setIsConfirmOpen(true);
  };

  const termsQuery = useQuery({
    queryFn: async () => await listTerms(),
    queryKey: adminQueryKeys.terms,
  });

  if (termsQuery.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {SKELETON_ROWS.map((key) => (
          <Skeleton className="h-12 rounded-xl" key={key} />
        ))}
      </div>
    );
  }

  if (termsQuery.isError) {
    return (
      <AdminErrorAlert error={termsQuery.error} title="Could not load terms" />
    );
  }

  const terms = termsQuery.data;
  const readyToArchive = terms.filter((term) => term.isReadyToArchive);
  const selectedTerms = terms.filter((term) =>
    selected.includes(term.termCode)
  );
  const toArchive = selectedTerms
    .filter((term) => term.archivedAt === null)
    .map((term) => term.termCode);
  const toUnarchive = selectedTerms
    .filter((term) => term.archivedAt !== null)
    .map((term) => term.termCode);

  const toggle = (termCode: string, checked: boolean) => {
    setSelected((current) =>
      checked
        ? [...new Set([...current, termCode])]
        : current.filter((code) => code !== termCode)
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {terms.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <DatabaseIcon />
                </EmptyMedia>
                <EmptyTitle>No terms yet</EmptyTitle>
                <EmptyDescription>
                  Terms are discovered by the section import, which reads them
                  straight from the Acadia portal. Run a section import from the
                  Imports tab to populate this table.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <>
          {readyToArchive.length > 0 && (
            <Alert variant="warning">
              <ArchiveIcon />
              <AlertTitle>
                {readyToArchive.length} term(s) ended and are still active
              </AlertTitle>
              <AlertDescription>
                Acadia&apos;s published dates are not always right, so nothing
                is archived automatically. Review the dates below before
                applying.
                <div>
                  <Button
                    onClick={() => {
                      confirmAction({
                        archived: true,
                        termCodes: readyToArchive.map((term) => term.termCode),
                      });
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <ArchiveIcon />
                    Archive all {readyToArchive.length}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Terms</CardTitle>
              <CardDescription>
                Archiving hides a term&apos;s sections from the student UI. No
                data is deleted and it is fully reversible.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={toArchive.length === 0}
                  onClick={() => {
                    confirmAction({ archived: true, termCodes: toArchive });
                  }}
                  size="sm"
                  variant="outline"
                >
                  <ArchiveIcon />
                  Archive selected
                </Button>
                <Button
                  disabled={toUnarchive.length === 0}
                  onClick={() => {
                    confirmAction({ archived: false, termCodes: toUnarchive });
                  }}
                  size="sm"
                  variant="outline"
                >
                  <ArchiveRestoreIcon />
                  Unarchive selected
                </Button>
                <span className="text-muted-foreground text-xs">
                  {selected.length} selected
                </span>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Term code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Sections</TableHead>
                    <TableHead className="text-right">Courses</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terms.map((term) => (
                    <TableRow key={term.termCode}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${term.termCode}`}
                          checked={selected.includes(term.termCode)}
                          onCheckedChange={(checked) => {
                            toggle(term.termCode, checked);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {term.termCode}
                      </TableCell>
                      <TableCell>{term.name}</TableCell>
                      <TableCell>{formatDate(term.startDate)}</TableCell>
                      <TableCell>{formatDate(term.endDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(term.sectionCount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(term.courseCount)}
                      </TableCell>
                      <TableCell>{statusBadge(term)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-base">Escape hatch</CardTitle>
          <CardDescription>
            Terms are auto-discovered by the importer. Only add one by hand for
            a term Acadia has not published sections for yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddTermDialog
            trigger={
              <Button size="sm" variant="outline">
                <CalendarPlusIcon />
                Add a term manually
              </Button>
            }
          />
        </CardContent>
      </Card>

      <ArchiveTermsDialog
        action={pendingAction}
        onClose={() => {
          setIsConfirmOpen(false);
        }}
        onSuccess={() => {
          setIsConfirmOpen(false);
          setSelected([]);
        }}
        open={isConfirmOpen}
      />
    </div>
  );
};
