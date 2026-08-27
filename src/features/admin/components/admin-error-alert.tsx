import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";

interface AdminErrorAlertProps {
  readonly error: Error;
  readonly title: string;
}

/**
 * Admin server functions reject with the middleware's message when the signed
 * session cookie is missing or stale (rotating `ADMIN_PASSWORD` invalidates
 * every outstanding session), so every failure offers a way back to sign-in.
 */
export const AdminErrorAlert = ({ error, title }: AdminErrorAlertProps) => (
  <Alert variant="error">
    <TriangleAlertIcon />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
    <AlertAction>
      <Link
        className={buttonVariants({ size: "sm", variant: "outline" })}
        to="/admin/login"
      >
        Sign in again
      </Link>
    </AlertAction>
  </Alert>
);
