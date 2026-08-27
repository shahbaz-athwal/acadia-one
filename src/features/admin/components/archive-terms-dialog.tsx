import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { archiveTerms, previewArchiveTerms } from "@/features/admin/api/terms";
import { formatNumber } from "@/features/admin/components/formatters";
import { adminQueryKeys } from "@/features/admin/components/query-keys";

export interface TermArchiveAction {
  readonly archived: boolean;
  readonly termCodes: string[];
}

interface ArchiveTermsDialogProps {
  /**
   * Kept populated while the dialog animates out, so the wording does not flash
   * back to "Unarchive 0 term(s)" on close.
   */
  readonly action: TermArchiveAction | null;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
  readonly open: boolean;
}

export const ArchiveTermsDialog = ({
  action,
  onClose,
  onSuccess,
  open,
}: ArchiveTermsDialogProps) => {
  const queryClient = useQueryClient();
  const isArchiving = action?.archived === true;
  const verb = isArchiving ? "Archive" : "Unarchive";

  const previewQuery = useQuery({
    enabled: open && action !== null,
    queryFn: async () =>
      await previewArchiveTerms({
        data: { termCodes: action?.termCodes ?? [] },
      }),
    queryKey: [...adminQueryKeys.terms, "preview", action?.termCodes],
  });

  const archiveMutation = useMutation({
    mutationFn: async (pending: TermArchiveAction) =>
      await archiveTerms({
        data: { archived: pending.archived, termCodes: pending.termCodes },
      }),
    onSuccess: async () => {
      onSuccess();
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  const impact = previewQuery.isPending
    ? "Counting affected rows…"
    : `This affects ${formatNumber(previewQuery.data?.sectionCount ?? 0)} section(s) across ${formatNumber(previewQuery.data?.courseCount ?? 0)} course(s). ${
        isArchiving
          ? "They will be hidden from the student UI."
          : "They will become visible in the student UI again."
      } No rows are deleted.`;

  return (
    <AlertDialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {verb} {action?.termCodes.length ?? 0} term(s)?
          </AlertDialogTitle>
          <AlertDialogDescription>{impact}</AlertDialogDescription>
        </AlertDialogHeader>
        {archiveMutation.isError && (
          <div className="px-6 pb-2 text-destructive-foreground text-sm">
            {archiveMutation.error.message}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>
            Cancel
          </AlertDialogClose>
          <Button
            disabled={archiveMutation.isPending}
            onClick={() => {
              if (action !== null) {
                archiveMutation.mutate(action);
              }
            }}
          >
            {verb}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
