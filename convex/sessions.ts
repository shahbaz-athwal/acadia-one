import { v } from "convex/values";
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
    const user = await ctx.db
      .query("acadiaUsers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!user || user.tokenHash !== args.tokenHash) {
      return { valid: false as const };
    }

    const session = await ctx.db
      .query("acadiaSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session || session.expiresAt <= Date.now()) {
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
    const user = await ctx.db
      .query("acadiaUsers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!user || user.tokenHash !== args.tokenHash) {
      return null;
    }
    return await ctx.db
      .query("acadiaUserData")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});
