import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { LockIcon, TriangleAlertIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getAdminAuthState, signInAdmin } from "@/features/admin/api/auth";
import { adminQueryKeys } from "@/features/admin/components/query-keys";

function AdminLoginComponent() {
  const router = useRouter();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");

  const authStateQuery = useQuery({
    queryFn: async () => await getAdminAuthState(),
    queryKey: adminQueryKeys.authState,
  });

  const signInMutation = useMutation({
    mutationFn: async (value: string) =>
      await signInAdmin({ data: { password: value } }),
    onSuccess: async () => {
      await router.invalidate();
      await navigate({ to: "/admin" });
    },
  });

  const submit: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    signInMutation.mutate(password);
  };

  const isConfigured = authStateQuery.data?.isConfigured !== false;

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>
            This dashboard is protected by a single shared secret.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConfigured ? (
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <Field>
                <FieldLabel htmlFor="admin-password">Password</FieldLabel>
                <Input
                  autoComplete="current-password"
                  id="admin-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                  }}
                  required
                  type="password"
                  value={password}
                />
              </Field>

              {signInMutation.isError && (
                <p className="text-destructive-foreground text-sm">
                  {signInMutation.error.message}
                </p>
              )}

              <Button disabled={signInMutation.isPending} type="submit">
                <LockIcon />
                Sign in
              </Button>
            </form>
          ) : (
            <Alert variant="error">
              <TriangleAlertIcon />
              <AlertTitle>ADMIN_PASSWORD is not set</AlertTitle>
              <AlertDescription>
                Set ADMIN_PASSWORD in the server environment to enable the admin
                dashboard.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export const Route = createFileRoute("/admin/login")({
  beforeLoad: async () => {
    const authState = await getAdminAuthState();

    if (authState.isAuthenticated) {
      // oxlint-disable-next-line typescript/only-throw-error -- TanStack Router signals redirects by throwing.
      throw redirect({ to: "/admin" });
    }
  },
  component: AdminLoginComponent,
  head: () => ({ meta: [{ title: "Admin sign in — Acadia One" }] }),
});
