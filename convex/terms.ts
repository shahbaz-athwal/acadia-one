import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      code: v.string(),
      name: v.string(),
      isActive: v.boolean(),
      startDate: v.number(),
      endDate: v.number(),
    })
  ),
  handler: async (ctx) => {
    const terms = await ctx.db.query("terms").collect();
    return terms
      .map((term) => ({
        code: term.code,
        name: term.name,
        isActive: term.isActive,
        startDate: term.startDate,
        endDate: term.endDate,
      }))
      .sort((a, b) => b.startDate - a.startDate);
  },
});
