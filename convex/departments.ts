import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      prefix: v.string(),
      name: v.string(),
      websiteUrl: v.optional(v.string()),
      facultyUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const departments = await ctx.db.query("departments").collect();
    return departments
      .map((department) => ({
        prefix: department.prefix,
        name: department.name,
        websiteUrl: department.websiteUrl,
        facultyUrl: department.facultyUrl,
      }))
      .sort((a, b) => a.prefix.localeCompare(b.prefix));
  },
});
