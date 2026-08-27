import { setTimeout as delay } from "node:timers/promises";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getDatabase } from "@/db";
import { recordAdminAction } from "@/server/admin/audit";
import {
  AdminAuthError,
  endAdminSession,
  hasAdminSession,
  isAdminPasswordConfigured,
  startAdminSession,
  verifyAdminPassword,
} from "@/server/admin/session";

/**
 * With no attempt counter left, this is the only thing standing between a
 * caller and an unlimited retry loop. It is not what protects the dashboard —
 * a generated `ADMIN_PASSWORD` is — it just makes guessing pointless rather
 * than merely slow, without a counter that could lock the operator out.
 */
const FAILED_SIGN_IN_DELAY_MS = 1000;

export const getAdminAuthState = createServerFn({ method: "GET" }).handler(
  () => ({
    isAuthenticated: hasAdminSession(),
    isConfigured: isAdminPasswordConfigured(),
  })
);

export const signInAdmin = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string().min(1) }))
  // `verifyAdminPassword` throws on its own when ADMIN_PASSWORD is unset, so
  // there is no separate "is it configured" guard here.
  .handler(async ({ data }) => {
    if (!verifyAdminPassword(data.password)) {
      await delay(FAILED_SIGN_IN_DELAY_MS);

      throw new AdminAuthError("That password is not correct.");
    }

    startAdminSession();
    // Only successful sign-ins are recorded: an unauthenticated caller must not
    // be able to write rows into the audit log.
    recordAdminAction(getDatabase(), {
      action: "admin.signIn",
      summary: "Signed in to the admin dashboard.",
    });

    return { isAuthenticated: true };
  });

// Deliberately unauthenticated: this only deletes the caller's own cookie, and
// gating it meant a session that had already expired could not be cleared.
export const signOutAdmin = createServerFn({ method: "POST" }).handler(() => {
  endAdminSession();

  return { isAuthenticated: false };
});
