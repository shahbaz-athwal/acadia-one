import { v } from "convex/values";
import { query } from "./_generated/server";

export const filterOptions = query({
  args: {},
  returns: v.object({
    terms: v.array(
      v.object({
        code: v.string(),
        name: v.string(),
        isActive: v.boolean(),
        startDate: v.number(),
        endDate: v.number(),
      }),
    ),
    departments: v.array(
      v.object({
        prefix: v.string(),
        name: v.string(),
        websiteUrl: v.optional(v.string()),
        facultyUrl: v.optional(v.string()),
      }),
    ),
    professors: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        departmentPrefix: v.string(),
        imageUrl: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const [termsRaw, departmentsRaw, professorsRaw] = await Promise.all([
      ctx.db.query("terms").collect(),
      ctx.db.query("departments").collect(),
      ctx.db.query("professors").collect(),
    ]);

    const terms = termsRaw
      .map((term) => ({
        code: term.code,
        name: term.name,
        isActive: term.isActive,
        startDate: term.startDate,
        endDate: term.endDate,
      }))
      .sort((a, b) => b.startDate - a.startDate);

    const departments = departmentsRaw
      .map((department) => ({
        prefix: department.prefix,
        name: department.name,
        websiteUrl: department.websiteUrl,
        facultyUrl: department.facultyUrl,
      }))
      .sort((a, b) => a.prefix.localeCompare(b.prefix));

    const professors = professorsRaw
      .map((professor) => ({
        id: professor.externalId,
        name: professor.name,
        departmentPrefix: professor.departmentPrefix,
        imageUrl: professor.imageUrl,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { terms, departments, professors };
  },
});
