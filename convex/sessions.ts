import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";

export const validateSession = query({
  args: {
    sessionId: v.string(),
    tokenHash: v.string(),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      studentId: v.string(),
      userDataStatus: v.union(
        v.literal("pending"),
        v.literal("ready"),
        v.null()
      ),
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
      userDataStatus: user.userDataStatus ?? null,
    };
  },
});

type UserData = NonNullable<Doc<"acadiaUsers">["userData"]>;

export const getUserData = query({
  args: {
    sessionId: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args): Promise<UserData | null> => {
    const user = await ctx.db
      .query("acadiaUsers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!user || user.tokenHash !== args.tokenHash) {
      return null;
    }

    return user.userData ?? null;
  },
});
