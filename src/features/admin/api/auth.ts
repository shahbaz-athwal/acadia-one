import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getDatabase } from "@/db";
import { recordAdminAction } from "@/server/admin/audit";
import { adminMiddleware } from "@/server/admin/middleware";
import {
  AdminAuthError,
  assertSignInAllowed,
  clearFailedSignIns,
  currentActorIp,
  endAdminSession,
  hasAdminSession,
  isAdminPasswordConfigured,
  recordFailedSignIn,
  startAdminSession,
  verifyAdminPassword,
} from "@/server/admin/session";

export const getAdminAuthState = createServerFn({ method: "GET" }).handler(
  () => ({
    isAuthenticated: hasAdminSession(),
    isConfigured: isAdminPasswordConfigured(),
  })
);

export const signInAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string().min(1) }))
  .handler(({ data }) => {
    if (!isAdminPasswordConfigured()) {
      throw new AdminAuthError(
        "ADMIN_PASSWORD is not set, so the admin dashboard is disabled."
      );
    }

    assertSignInAllowed();

    if (!verifyAdminPassword(data.password)) {
      recordFailedSignIn();

      throw new AdminAuthError("That password is not correct.");
    }

    clearFailedSignIns();
    startAdminSession();
    // Only successful sign-ins are recorded: an unauthenticated caller must not
    // be able to write rows into the audit log.
    recordAdminAction(getDatabase(), {
      action: "admin.signIn",
      actorIp: currentActorIp(),
      summary: "Signed in to the admin dashboard.",
    });

    return { isAuthenticated: true };
  });

export const signOutAdmin = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .handler(() => {
    endAdminSession();

    return { isAuthenticated: false };
  });
