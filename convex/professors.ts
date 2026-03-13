import { v } from "convex/values";
import { getOneFrom } from "convex-helpers/server/relationships";
import { query } from "./_generated/server";

export const getSheetByExternalId = query({
  args: {
    externalId: v.string(),
  },
  returns: v.union(
    v.object({
      externalId: v.string(),
      name: v.string(),
      departmentPrefix: v.string(),
      designation: v.optional(v.string()),
      officeLocation: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      linkedinUrl: v.optional(v.string()),
      websiteUrl: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      ratingCount: v.number(),
      avgDifficulty: v.union(v.number(), v.null()),
      avgQuality: v.union(v.number(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const professor = await getOneFrom(
      ctx.db,
      "professors",
      "by_externalId",
      args.externalId.trim()
    );

    if (!professor) {
      return null;
    }

    return {
      externalId: professor.externalId,
      name: professor.name,
      departmentPrefix: professor.departmentPrefix,
      designation: professor.designation,
      officeLocation: professor.officeLocation,
      email: professor.email,
      phone: professor.phone,
      linkedinUrl: professor.linkedinUrl,
      websiteUrl: professor.websiteUrl,
      imageUrl: professor.imageUrl,
      ratingCount: professor.ratingCount,
      avgDifficulty: professor.avgDifficulty,
      avgQuality: professor.avgQuality,
    };
  },
});
