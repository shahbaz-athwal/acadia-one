import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export const tryAcquire = internalMutation({
  args: {
    key: v.string(),
    ttlMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const ttlMs = args.ttlMs ?? DEFAULT_TTL_MS;
    const now = Date.now();
    const existing = await ctx.db
      .query("jobLocks")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing && existing.lockExpiresAt > now) {
      return false;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        lockedAt: now,
        lockExpiresAt: now + ttlMs,
      });
      return true;
    }

    await ctx.db.insert("jobLocks", {
      key: args.key,
      lockedAt: now,
      lockExpiresAt: now + ttlMs,
    });
    return true;
  },
});

export const release = internalMutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jobLocks")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});
