import { createMiddleware } from "@tanstack/react-start";

import { AdminAuthError, hasAdminSession } from "@/server/admin/session";

/**
 * Server-side gate for every admin server function. Attach it with
 * `createServerFn().middleware([adminMiddleware])` — the `/admin` route guard
 * only decides what to render and cannot be trusted.
 *
 * This throws rather than redirecting: a thrown `redirect()` is swallowed by
 * TanStack Query as an opaque "data is undefined" failure, whereas the error
 * message reaches the client and the panels render it with a link back to the
 * sign-in form.
 */
export const adminMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!hasAdminSession()) {
      throw new AdminAuthError(
        "Your admin session is not valid. Sign in again."
      );
    }

    return await next();
  }
);
