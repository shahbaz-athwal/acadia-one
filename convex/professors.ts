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
      departmentName: v.string(),
      designation: v.optional(v.string()),
      officeLocation: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      linkedinUrl: v.optional(v.string()),
      websiteUrl: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      description: v.optional(v.string()),
      researchAreas: v.optional(v.array(v.string())),
      sourceUrl: v.optional(v.string()),
      ratingCount: v.number(),
      avgDifficulty: v.union(v.number(), v.null()),
      avgQuality: v.union(v.number(), v.null()),
      ratings: v.array(
        v.object({
          courseCode: v.string(),
          courseTitle: v.string(),
          quality: v.number(),
          difficulty: v.number(),
          isForCredit: v.optional(v.boolean()),
          comment: v.optional(v.string()),
          textBookRequired: v.optional(v.boolean()),
          attendanceRequired: v.boolean(),
          gradeReceived: v.optional(v.string()),
          wouldTakeAgain: v.optional(v.boolean()),
          thumbsUpTotal: v.number(),
          thumbsDownTotal: v.number(),
          tags: v.array(v.string()),
          postedAt: v.number(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const professor = await getOneFrom(
      ctx.db,
      "professors",
      "by_externalId",
      args.externalId.trim(),
    );

    if (!professor) {
      return null;
    }

    const department = await getOneFrom(
      ctx.db,
      "departments",
      "by_prefix",
      professor.departmentPrefix,
    );
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_professorId", (q) => q.eq("professorId", professor._id))
      .collect();
    const approvedRatings = ratings
      .filter((rating) => rating.status === "APPROVED")
      .sort((a, b) => b.postedAt - a.postedAt);
    const courseIds = [...new Set(approvedRatings.map((rating) => rating.courseId))];
    const courses = await Promise.all(courseIds.map((courseId) => ctx.db.get(courseId)));
    const courseById = new Map(
      courses
        .filter((course): course is NonNullable<typeof course> => !!course)
        .map((course) => [course._id, course]),
    );

    return {
      externalId: professor.externalId,
      name: professor.name,
      departmentPrefix: professor.departmentPrefix,
      departmentName: department?.name ?? professor.departmentPrefix,
      designation: professor.designation,
      officeLocation: professor.officeLocation,
      email: professor.email,
      phone: professor.phone,
      linkedinUrl: professor.linkedinUrl,
      websiteUrl: professor.websiteUrl,
      imageUrl: professor.imageUrl,
      description: professor.description,
      researchAreas: professor.researchAreas,
      sourceUrl: professor.sourceUrl,
      ratingCount: professor.ratingCount,
      avgDifficulty: professor.avgDifficulty,
      avgQuality: professor.avgQuality,
      ratings: approvedRatings.map((rating) => {
        const course = courseById.get(rating.courseId);

        return {
          courseCode: course?.code ?? "",
          courseTitle: course?.title ?? "",
          quality: rating.quality,
          difficulty: rating.difficulty,
          isForCredit: rating.isForCredit,
          comment: rating.comment,
          textBookRequired: rating.textBookRequired,
          attendanceRequired: rating.attendanceRequired,
          gradeReceived: rating.gradeReceived,
          wouldTakeAgain: rating.wouldTakeAgain,
          thumbsUpTotal: rating.thumbsUpTotal,
          thumbsDownTotal: rating.thumbsDownTotal,
          tags: rating.tags,
          postedAt: rating.postedAt,
        };
      }),
    };
  },
});
