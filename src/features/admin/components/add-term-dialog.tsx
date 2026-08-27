import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TriangleAlertIcon } from "lucide-react";
import type { ComponentProps, ReactElement } from "react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createTerm } from "@/features/admin/api/terms";

interface AddTermDialogProps {
  readonly trigger: ReactElement;
}

interface TermDraft {
  readonly endDate: string;
  readonly name: string;
  readonly startDate: string;
  readonly termCode: string;
}

const EMPTY_DRAFT: TermDraft = {
  endDate: "",
  name: "",
  startDate: "",
  termCode: "",
};

export const AddTermDialog = ({ trigger }: AddTermDialogProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TermDraft>(EMPTY_DRAFT);

  const createMutation = useMutation({
    mutationFn: async (values: TermDraft) => await createTerm({ data: values }),
    onSuccess: async () => {
      setDraft(EMPTY_DRAFT);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  const submit: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    createMutation.mutate(draft);
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add a term manually</DialogTitle>
            <DialogDescription>
              This is a rarely-used escape hatch, not the normal path.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <Alert variant="warning">
              <TriangleAlertIcon />
              <AlertTitle>termCode must match Acadia exactly</AlertTitle>
              <AlertDescription>
                termCode is the primary key and normally comes from the portal.
                A typo here silently creates a duplicate row once the real term
                arrives in a section import.
              </AlertDescription>
            </Alert>

            <Field>
              <FieldLabel htmlFor="term-code">Term code</FieldLabel>
              <Input
                id="term-code"
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    termCode: event.target.value,
                  }));
                }}
                placeholder="2026FA"
                required
                value={draft.termCode}
              />
              <FieldDescription>
                Copy this from the portal rather than typing it.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="term-name">Name</FieldLabel>
              <Input
                id="term-name"
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }));
                }}
                placeholder="Fall 2026"
                required
                value={draft.name}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="term-start">Start date</FieldLabel>
              <Input
                id="term-start"
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }));
                }}
                required
                type="date"
                value={draft.startDate}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="term-end">End date</FieldLabel>
              <Input
                id="term-end"
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }));
                }}
                required
                type="date"
                value={draft.endDate}
              />
            </Field>

            {createMutation.isError && (
              <p className="text-destructive-foreground text-sm">
                {createMutation.error.message}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={createMutation.isPending} type="submit">
              Add term
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
