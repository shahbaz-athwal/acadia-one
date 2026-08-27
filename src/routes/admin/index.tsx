import { createFileRoute, redirect } from "@tanstack/react-router";

import { getAdminAuthState } from "@/features/admin/api/auth";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";

export const Route = createFileRoute("/admin/")({
  // Convenience redirect only. The real check lives in `adminMiddleware`, which
  // every admin server function runs through.
  beforeLoad: async () => {
    const authState = await getAdminAuthState();

    if (!authState.isAuthenticated) {
      // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router signals redirects by throwing.
      throw redirect({ to: "/admin/login" });
    }
  },
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Database admin — Acadia One" }] }),
});
