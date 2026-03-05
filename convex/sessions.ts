import { v } from "convex/values";
import { getOneFrom } from "convex-helpers/server/relationships";
import { literals } from "convex-helpers/validators";
import { mutation, query } from "./_generated/server";
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
      profileFirstName: v.optional(v.string()),
      profileLastName: v.optional(v.string()),
    }),
    v.object({
      valid: v.literal(false),
    })
  ),
  handler: async (ctx, args) => {
    const [user, session, userData] = await Promise.all([
      getOneFrom(ctx.db, "acadiaUsers", "by_sessionId", args.sessionId),
      getOneFrom(ctx.db, "acadiaSessions", "by_sessionId", args.sessionId),
      getOneFrom(ctx.db, "acadiaUserData", "by_sessionId", args.sessionId),
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
      profileFirstName: userData?.profile.firstName,
      profileLastName: userData?.profile.lastName,
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

export const logoutSession = mutation({
  args: {
    sessionId: v.string(),
    tokenHash: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const [users, sessions, userDataRows] = await Promise.all([
      ctx.db
        .query("acadiaUsers")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("acadiaSessions")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("acadiaUserData")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
    ]);

    const isAuthorized = users.some(
      (user) => user.tokenHash === args.tokenHash
    );
    if (!isAuthorized) {
      return { success: false };
    }

    for (const userData of userDataRows) {
      await ctx.db.delete(userData._id);
    }
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    return { success: true };
  },
});
