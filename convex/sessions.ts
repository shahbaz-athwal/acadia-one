import { v } from "convex/values";
import { getOneFrom } from "convex-helpers/server/relationships";
import { literals } from "convex-helpers/validators";
import { query } from "./_generated/server";
import { vv } from "./schema";

export const validateSession = query({
  args: {
    sessionId: v.string(),
    tokenHash: v.string(),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      studentId: v.string(),
      userDataStatus: literals("pending", "ready", "error"),
    }),
    v.object({
      valid: v.literal(false),
    })
  ),
  handler: async (ctx, args) => {
    const [user, session] = await Promise.all([
      getOneFrom(ctx.db, "acadiaUsers", "by_sessionId", args.sessionId),
      getOneFrom(ctx.db, "acadiaSessions", "by_sessionId", args.sessionId),
    ]);

    if (!user || user.tokenHash !== args.tokenHash) {
      return { valid: false as const };
    }

    const now = Date.now();
    if (!session || session.expiresAt <= now) {
      return { valid: false as const };
    }

    return {
      valid: true as const,
      studentId: user.studentId,
      userDataStatus: user.userDataStatus,
    };
  },
});

export const getUserData = query({
  args: {
    sessionId: v.string(),
    tokenHash: v.string(),
  },
  returns: v.union(vv.doc("acadiaUserData"), v.null()),
  handler: async (ctx, args) => {
    const [user, userData] = await Promise.all([
      getOneFrom(ctx.db, "acadiaUsers", "by_sessionId", args.sessionId),
      getOneFrom(ctx.db, "acadiaUserData", "by_sessionId", args.sessionId),
    ]);

    if (!user || user.tokenHash !== args.tokenHash) {
      return null;
    }
    return userData;
  },
});
