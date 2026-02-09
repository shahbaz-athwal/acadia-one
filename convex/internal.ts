import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";

export const insertLog = internalMutation({
  args: { message: v.string() },
  returns: v.id("logs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("logs", {
      message: args.message,
      createdAt: Date.now(),
    });
  },
});

export const getAcadiaAuth = internalQuery({
  args: { provider: v.string() },
  returns: v.union(
    v.object({
      cookies: v.string(),
      encryptedCredentials: v.string(),
      lastAcadiaAuth: v.number(),
      expiresAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("acadiaAuth")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();
    if (!existing) {
      return null;
    }
    return {
      cookies: existing.cookies,
      encryptedCredentials: existing.encryptedCredentials,
      lastAcadiaAuth: existing.lastAcadiaAuth,
      expiresAt: existing.expiresAt,
    };
  },
});

export const upsertAcadiaAuth = internalMutation({
  args: {
    provider: v.string(),
    cookies: v.string(),
    encryptedCredentials: v.string(),
    lastAcadiaAuth: v.number(),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("acadiaAuth")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        cookies: args.cookies,
        encryptedCredentials: args.encryptedCredentials,
        lastAcadiaAuth: args.lastAcadiaAuth,
        expiresAt: args.expiresAt,
        updatedAt,
      });
      return null;
    }
    await ctx.db.insert("acadiaAuth", {
      provider: args.provider,
      cookies: args.cookies,
      encryptedCredentials: args.encryptedCredentials,
      lastAcadiaAuth: args.lastAcadiaAuth,
      expiresAt: args.expiresAt,
      updatedAt,
    });
    return null;
  },
});

export const upsertDepartments = internalMutation({
  args: {
    departments: v.array(
      v.object({
        prefix: v.string(),
        name: v.string(),
        websiteUrl: v.optional(v.string()),
        facultyUrl: v.optional(v.string()),
      })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let processed = 0;
    for (const department of args.departments) {
      const existing = await ctx.db
        .query("departments")
        .withIndex("by_prefix", (q) => q.eq("prefix", department.prefix))
        .first();
      if (existing) {
        const update: Record<string, unknown> = { name: department.name };
        if (department.websiteUrl !== undefined) {
          update.websiteUrl = department.websiteUrl;
        }
        if (department.facultyUrl !== undefined) {
          update.facultyUrl = department.facultyUrl;
        }
        await ctx.db.patch(existing._id, update);
      } else {
        await ctx.db.insert("departments", department);
      }
      processed += 1;
    }
    return processed;
  },
});

export const upsertTerms = internalMutation({
  args: {
    terms: v.array(
      v.object({
        code: v.string(),
        name: v.string(),
        isActive: v.boolean(),
        startDate: v.number(),
        endDate: v.number(),
      })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let processed = 0;
    for (const term of args.terms) {
      const existing = await ctx.db
        .query("terms")
        .withIndex("by_code", (q) => q.eq("code", term.code))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, term);
      } else {
        await ctx.db.insert("terms", term);
      }
      processed += 1;
    }
    return processed;
  },
});

export const upsertProfessors = internalMutation({
  args: {
    professors: v.array(
      v.object({
        externalId: v.string(),
        name: v.string(),
        departmentPrefix: v.string(),
        rmpId: v.optional(v.string()),
        rmpLegacyId: v.optional(v.number()),
        designation: v.optional(v.string()),
        officeLocation: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        linkedinUrl: v.optional(v.string()),
        websiteUrl: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        lastPullFromRmp: v.optional(v.number()),
      })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let processed = 0;
    for (const professor of args.professors) {
      const existing = await ctx.db
        .query("professors")
        .withIndex("by_externalId", (q) =>
          q.eq("externalId", professor.externalId)
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, professor);
      } else {
        await ctx.db.insert("professors", professor);
      }
      processed += 1;
    }
    return processed;
  },
});

export const upsertCourses = internalMutation({
  args: {
    courses: v.array(
      v.object({
        externalId: v.string(),
        code: v.string(),
        title: v.string(),
        description: v.string(),
        departmentPrefix: v.string(),
        matchingSectionIds: v.array(v.string()),
        credits: v.number(),
        requisites: v.optional(
          v.array(
            v.object({
              codes: v.array(v.string()),
              displayText: v.string(),
              displayTextAnnotated: v.string(),
              displayTextExtension: v.string(),
              displayTextExtensionAnnotated: v.optional(v.string()),
            })
          )
        ),
      })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let processed = 0;
    for (const course of args.courses) {
      const existing = await ctx.db
        .query("courses")
        .withIndex("by_externalId", (q) =>
          q.eq("externalId", course.externalId)
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          code: course.code,
          title: course.title,
          description: course.description,
          departmentPrefix: course.departmentPrefix,
          matchingSectionIds: course.matchingSectionIds,
          credits: course.credits,
          requisites: course.requisites,
        });
      } else {
        await ctx.db.insert("courses", {
          ...course,
          lastSectionPulledAt: undefined,
          ratingCount: 0,
          avgDifficulty: null,
          avgQuality: null,
        });
      }
      processed += 1;
    }
    return processed;
  },
});

export const upsertCourseProfessors = internalMutation({
  args: {
    links: v.array(
      v.object({
        courseId: v.id("courses"),
        professorId: v.id("professors"),
        courseExternalId: v.string(),
        professorExternalId: v.string(),
      })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let created = 0;
    for (const link of args.links) {
      const existing = await ctx.db
        .query("courseProfessors")
        .withIndex("by_courseId_and_professorId", (q) =>
          q.eq("courseId", link.courseId).eq("professorId", link.professorId)
        )
        .first();
      if (!existing) {
        await ctx.db.insert("courseProfessors", link);
        created += 1;
      }
    }
    return created;
  },
});

export const upsertSections = internalMutation({
  args: {
    sections: v.array(
      v.object({
        externalId: v.string(),
        termCode: v.string(),
        courseId: v.id("courses"),
        courseExternalId: v.string(),
        professorId: v.optional(v.id("professors")),
        sectionCode: v.string(),
        sectionSearchName: v.string(),
        classStartTime: v.string(),
        classEndTime: v.string(),
        buildingName: v.string(),
        roomNumber: v.string(),
        days: v.array(v.number()),
        refreshedAt: v.number(),
        instructorTBD: v.boolean(),
        isOnline: v.boolean(),
      })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let processed = 0;
    for (const section of args.sections) {
      const existing = await ctx.db
        .query("sections")
        .withIndex("by_externalId_and_termCode", (q) =>
          q
            .eq("externalId", section.externalId)
            .eq("termCode", section.termCode)
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, section);
      } else {
        await ctx.db.insert("sections", section);
      }
      processed += 1;
    }
    return processed;
  },
});

export const updateCourseLastSectionPulledAt = internalMutation({
  args: {
    courseId: v.id("courses"),
    lastSectionPulledAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.courseId, {
      lastSectionPulledAt: args.lastSectionPulledAt,
    });
    return null;
  },
});

export const updateProfessorLastPullFromRmp = internalMutation({
  args: {
    professorId: v.id("professors"),
    lastPullFromRmp: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.professorId, {
      lastPullFromRmp: args.lastPullFromRmp,
    });
    return null;
  },
});

export const insertRatings = internalMutation({
  args: {
    ratings: v.array(
      v.object({
        rmpId: v.optional(v.string()),
        rmpLegacyId: v.optional(v.number()),
        status: v.string(),
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
        professorId: v.id("professors"),
        courseId: v.id("courses"),
        postedAt: v.number(),
      })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const rating of args.ratings) {
      if (rating.rmpId) {
        const existing = await ctx.db
          .query("ratings")
          .withIndex("by_rmpId", (q) => q.eq("rmpId", rating.rmpId))
          .first();
        if (existing) {
          continue;
        }
      }
      await ctx.db.insert("ratings", rating);
      inserted += 1;
    }
    return inserted;
  },
});

export const recomputeCourseAggregates = internalMutation({
  args: { courseId: v.id("courses") },
  returns: v.object({
    ratingCount: v.number(),
    avgDifficulty: v.union(v.number(), v.null()),
    avgQuality: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();
    const ratingCount = ratings.length;
    if (ratingCount === 0) {
      await ctx.db.patch(args.courseId, {
        ratingCount: 0,
        avgDifficulty: null,
        avgQuality: null,
      });
      return { ratingCount: 0, avgDifficulty: null, avgQuality: null };
    }
    const difficultySum = ratings.reduce((sum, r) => sum + r.difficulty, 0);
    const qualitySum = ratings.reduce((sum, r) => sum + r.quality, 0);
    const avgDifficulty = difficultySum / ratingCount;
    const avgQuality = qualitySum / ratingCount;
    await ctx.db.patch(args.courseId, {
      ratingCount,
      avgDifficulty,
      avgQuality,
    });
    return { ratingCount, avgDifficulty, avgQuality };
  },
});

export const getCourseByExternalId = internalQuery({
  args: { externalId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("courses"),
      externalId: v.string(),
      code: v.string(),
      title: v.string(),
      departmentPrefix: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const course = await ctx.db
      .query("courses")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .first();

    if (!course) {
      return null;
    }

    return {
      _id: course._id,
      externalId: course.externalId,
      code: course.code,
      title: course.title,
      departmentPrefix: course.departmentPrefix,
    };
  },
});

export const getProfessorByExternalId = internalQuery({
  args: { externalId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("professors"),
      externalId: v.string(),
      name: v.string(),
      departmentPrefix: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const professor = await ctx.db
      .query("professors")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .first();

    if (!professor) {
      return null;
    }

    return {
      _id: professor._id,
      externalId: professor.externalId,
      name: professor.name,
      departmentPrefix: professor.departmentPrefix,
    };
  },
});

export const getCoursesByCodes = internalQuery({
  args: { codes: v.array(v.string()) },
  returns: v.array(
    v.object({
      _id: v.id("courses"),
      code: v.string(),
      externalId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const results: Array<{
      _id: Id<"courses">;
      code: string;
      externalId: string;
    }> = [];
    for (const code of args.codes) {
      const course = await ctx.db
        .query("courses")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (course) {
        results.push({
          _id: course._id,
          code: course.code,
          externalId: course.externalId,
        });
      }
    }
    return results;
  },
});

export const listCoursesForProcessing = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("courses"),
      externalId: v.string(),
      matchingSectionIds: v.array(v.string()),
      departmentPrefix: v.string(),
    })
  ),
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    return courses
      .filter((course) => course.matchingSectionIds.length > 0)
      .map((course) => ({
        _id: course._id,
        externalId: course.externalId,
        matchingSectionIds: course.matchingSectionIds,
        departmentPrefix: course.departmentPrefix,
      }));
  },
});

export const listProfessorsWithRmpId = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("professors"),
      rmpId: v.string(),
    })
  ),
  handler: async (ctx) => {
    const professors = await ctx.db.query("professors").collect();
    return professors
      .filter((professor) => !!professor.rmpId)
      .map((professor) => ({
        _id: professor._id,
        rmpId: professor.rmpId as string,
      }));
  },
});

export const listAllProfessors = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      externalId: v.string(),
      name: v.string(),
      departmentPrefix: v.string(),
    })
  ),
  handler: async (ctx) => {
    const professors = await ctx.db.query("professors").collect();
    return professors.map((professor) => ({
      externalId: professor.externalId,
      name: professor.name,
      departmentPrefix: professor.departmentPrefix,
    }));
  },
});

export const listProfessorsWithoutRmpId = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      externalId: v.string(),
      name: v.string(),
      departmentPrefix: v.string(),
    })
  ),
  handler: async (ctx) => {
    const professors = await ctx.db.query("professors").collect();
    return professors
      .filter((professor) => !professor.rmpId)
      .map((professor) => ({
        externalId: professor.externalId,
        name: professor.name,
        departmentPrefix: professor.departmentPrefix,
      }));
  },
});

export const getProfessorById = internalQuery({
  args: { id: v.id("professors") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("professors"),
      externalId: v.string(),
      name: v.string(),
      departmentPrefix: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const professor = await ctx.db.get(args.id);
    if (!professor) {
      return null;
    }
    return {
      _id: professor._id,
      externalId: professor.externalId,
      name: professor.name,
      departmentPrefix: professor.departmentPrefix,
    };
  },
});

export const updateProfessorRmpIds = internalMutation({
  args: {
    updates: v.array(
      v.object({
        externalId: v.string(),
        rmpId: v.string(),
        rmpLegacyId: v.number(),
      })
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let updated = 0;
    for (const update of args.updates) {
      const professor = await ctx.db
        .query("professors")
        .withIndex("by_externalId", (q) =>
          q.eq("externalId", update.externalId)
        )
        .first();
      if (!professor) {
        continue;
      }
      await ctx.db.patch(professor._id, {
        rmpId: update.rmpId,
        rmpLegacyId: update.rmpLegacyId,
      });
      updated += 1;
    }
    return updated;
  },
});
