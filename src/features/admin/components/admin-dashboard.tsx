import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { signOutAdmin } from "@/features/admin/api/auth";
import { AuditPanel } from "@/features/admin/components/audit-panel";
import { ImportsPanel } from "@/features/admin/components/imports-panel";
import { OverviewPanel } from "@/features/admin/components/overview-panel";
import { TermsPanel } from "@/features/admin/components/terms-panel";

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOutMutation = useMutation({
    mutationFn: async () => await signOutAdmin(),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["admin"] });
      await navigate({ to: "/admin/login" });
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Database admin</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Row counts, operational health, term archive triage, and imports.
          </p>
        </div>
        <Button
          disabled={signOutMutation.isPending}
          onClick={() => {
            signOutMutation.mutate();
          }}
          size="sm"
          variant="outline"
        >
          <LogOutIcon />
          Sign out
        </Button>
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-fit sm:justify-start">
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="terms">Terms</TabsTab>
          <TabsTab value="imports">Imports</TabsTab>
          <TabsTab value="audit">Audit log</TabsTab>
        </TabsList>

        <TabsPanel className="pt-2" value="overview">
          <OverviewPanel />
        </TabsPanel>
        <TabsPanel className="pt-2" value="terms">
          <TermsPanel />
        </TabsPanel>
        <TabsPanel className="pt-2" value="imports">
          <ImportsPanel />
        </TabsPanel>
        <TabsPanel className="pt-2" value="audit">
          <AuditPanel />
        </TabsPanel>
      </Tabs>
    </div>
  );
};
