import { v } from "convex/values";
import { asyncMap } from "convex-helpers";
import { literals } from "convex-helpers/validators";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { getExistingRatingLookup } from "./lib/ratingIdentity";
import { vv } from "./schema";

const IS_LAB_COURSE_CODE_RE = /\d+L$/i;
const ACADEMIC_LEVEL_RE = /(\d{3,4})[A-Z]?$/;

function buildCourseSearchText(course: { code: string; title: string; description?: string }) {
  return [course.code, course.title, course.description ?? ""]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
}

function isLabCourseCode(courseCode: string) {
  return IS_LAB_COURSE_CODE_RE.test(courseCode.trim().toUpperCase());
}

function getAcademicLevel(courseCode: string) {
  const normalizedCode = courseCode.trim().toUpperCase();
  const match = normalizedCode.match(ACADEMIC_LEVEL_RE);
  const levelDigit = match?.[1]?.[0];
  const parsed = levelDigit ? Number.parseInt(levelDigit, 10) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const getAcadiaSession = internalQuery({
  args: { sessionId: v.string() },
  returns: v.union(
    v.object({
      cookies: v.string(),
      lastAcadiaAuth: v.number(),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("acadiaSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!existing) {
      return null;
    }
    return {
      cookies: existing.cookies,
      lastAcadiaAuth: existing.lastAcadiaAuth,
      expiresAt: existing.expiresAt,
    };
  },
});

export const upsertAcadiaSession = internalMutation({
  args: vv.doc("acadiaSessions").omit("_id", "_creationTime", "updatedAt"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("acadiaSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        cookies: args.cookies,
        lastAcadiaAuth: args.lastAcadiaAuth,
        expiresAt: args.expiresAt,
        updatedAt,
      });
    }
    await ctx.db.insert("acadiaSessions", {
      sessionId: args.sessionId,
      cookies: args.cookies,
      lastAcadiaAuth: args.lastAcadiaAuth,
      expiresAt: args.expiresAt,
      updatedAt,
    });
  },
});

export const getAcadiaUser = internalQuery({
  args: { sessionId: v.string() },
  returns: v.union(vv.doc("acadiaUsers"), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("acadiaUsers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

export const createAcadiaSessionAndUser = internalMutation({
  args: {
    sessionId: v.string(),
    cookies: v.string(),
    lastAcadiaAuth: v.number(),
    expiresAt: v.number(),
    studentId: v.string(),
    encryptedCredentials: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const updatedAt = Date.now();

    const existingSession = await ctx.db
      .query("acadiaSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existingSession) {
      await ctx.db.patch(existingSession._id, {
        cookies: args.cookies,
        lastAcadiaAuth: args.lastAcadiaAuth,
        expiresAt: args.expiresAt,
        updatedAt,
      });
    } else {
      await ctx.db.insert("acadiaSessions", {
        sessionId: args.sessionId,
        cookies: args.cookies,
        lastAcadiaAuth: args.lastAcadiaAuth,
        expiresAt: args.expiresAt,
        updatedAt,
      });
    }

    const existingUser = await ctx.db
      .query("acadiaUsers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        studentId: args.studentId,
        encryptedCredentials: args.encryptedCredentials,
        tokenHash: args.tokenHash,
        updatedAt,
      });
    } else {
      await ctx.db.insert("acadiaUsers", {
        sessionId: args.sessionId,
        studentId: args.studentId,
        encryptedCredentials: args.encryptedCredentials,
        tokenHash: args.tokenHash,
        userDataStatus: "pending",
        updatedAt,
      });
    }
  },
});

export const setAcadiaUserDataStatus = internalMutation({
  args: {
    sessionId: v.string(),
    status: literals("pending", "ready", "error"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("acadiaUsers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!existingUser) {
      return;
    }

    const updatedAt = Date.now();
    await ctx.db.patch(existingUser._id, {
      userDataStatus: args.status,
      userDataPullError: args.error ?? undefined,
      updatedAt,
    });
  },
});

export const setAcadiaUserData = internalMutation({
  args: vv
    .doc("acadiaUserData")
    .pick(
      "sessionId",
      "profile",
      "programs",
      "grades",
      "programEvaluation",
      "coursePlanningStatuses",
    ),
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("acadiaUsers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!existingUser) {
      return;
    }

    const updatedAt = Date.now();
    await ctx.db.patch(existingUser._id, {
      userDataStatus: "ready",
      userDataPullError: undefined,
      updatedAt,
    });
    const existingUserData = await ctx.db
      .query("acadiaUserData")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existingUserData) {
      await ctx.db.patch(existingUserData._id, {
        ...args,
        updatedAt,
      });
      return null;
    }
    await ctx.db.insert("acadiaUserData", {
      ...args,
      updatedAt,
    });
  },
});

export const getExistingRsgKeys = internalQuery({
  args: { keys: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const rows = await asyncMap(args.keys, (key) =>
      ctx.db
        .query("rsg")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first(),
    );

    return rows.filter((row): row is NonNullable<typeof row> => !!row).map((row) => row.key);
  },
});

export const getRsgEntriesByKeys = internalQuery({
  args: { keys: v.array(v.string()) },
  returns: v.array(
    v.object({
      key: v.string(),
      courseCodes: v.array(v.string()),
      type: literals("exact", "search"),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await asyncMap(args.keys, (key) =>
      ctx.db
        .query("rsg")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first(),
    );

    return rows
      .filter((row): row is NonNullable<typeof row> => !!row)
      .map((row) => ({
        key: row.key,
        courseCodes: row.courseCodes,
        type: row.type,
      }));
  },
});

export const upsertRsgEntries = internalMutation({
  args: {
    entries: v.array(vv.doc("rsg").omit("_id", "_creationTime")),
  },
  handler: async (ctx, args) => {
    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("rsg")
        .withIndex("by_key", (q) => q.eq("key", entry.key))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          courseCodes: entry.courseCodes,
          type: entry.type,
        });
      } else {
        await ctx.db.insert("rsg", entry);
      }
    }
  },
});

export const existsDepartments = internalMutation({
  args: {
    departments: v.array(vv.doc("departments").pick("prefix", "name")),
  },
  handler: async (ctx, args) => {
    for (const department of args.departments) {
      const existing = await ctx.db
        .query("departments")
        .withIndex("by_prefix", (q) => q.eq("prefix", department.prefix))
        .first();
      if (existing) {
        continue;
      }
      await ctx.db.insert("departments", department);
    }
  },
});

export const existsTerms = internalMutation({
  args: {
    terms: v.array(vv.doc("terms").omit("_id", "_creationTime")),
  },
  handler: async (ctx, args) => {
    for (const term of args.terms) {
      const existing = await ctx.db
        .query("terms")
        .withIndex("by_code", (q) => q.eq("code", term.code))
        .first();
      if (existing) {
        continue;
      }
      await ctx.db.insert("terms", term);
    }
  },
});

export const existsProfessors = internalMutation({
  args: {
    professors: v.array(vv.doc("professors").pick("externalId", "name", "departmentPrefix")),
  },
  handler: async (ctx, args) => {
    for (const professor of args.professors) {
      const existing = await ctx.db
        .query("professors")
        .withIndex("by_externalId", (q) => q.eq("externalId", professor.externalId))
        .first();
      if (existing) {
        continue;
      }
      await ctx.db.insert("professors", {
        ...professor,
        ratingCount: 0,
        avgDifficulty: null,
        avgQuality: null,
      });
    }
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
            }),
          ),
        ),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let processed = 0;
    for (const course of args.courses) {
      const existing = await ctx.db
        .query("courses")
        .withIndex("by_externalId", (q) => q.eq("externalId", course.externalId))
        .first();
      const searchText = buildCourseSearchText(course);
      const isLab = isLabCourseCode(course.code);
      const academicLevel = getAcademicLevel(course.code);
      if (existing) {
        await ctx.db.patch(existing._id, {
          code: course.code,
          title: course.title,
          description: course.description,
          departmentPrefix: course.departmentPrefix,
          matchingSectionIds: course.matchingSectionIds,
          credits: course.credits,
          isLab,
          academicLevel,
          requisites: course.requisites,
          searchText,
        });
      } else {
        await ctx.db.insert("courses", {
          ...course,
          isLab,
          academicLevel,
          searchText,
          lastSectionPulledAt: undefined,
          ratingCount: 0,
          avgDifficulty: null,
          avgQuality: null,
        });

        // Increment denormalized course counters
        const totalStats = await ctx.db
          .query("courseStats")
          .withIndex("by_key", (q) => q.eq("key", "total"))
          .first();
        if (totalStats) {
          await ctx.db.patch(totalStats._id, {
            courseCount: totalStats.courseCount + 1,
          });
        } else {
          await ctx.db.insert("courseStats", { key: "total", courseCount: 1 });
        }

        const deptKey = `dept:${course.departmentPrefix}`;
        const deptStats = await ctx.db
          .query("courseStats")
          .withIndex("by_key", (q) => q.eq("key", deptKey))
          .first();
        if (deptStats) {
          await ctx.db.patch(deptStats._id, {
            courseCount: deptStats.courseCount + 1,
          });
        } else {
          await ctx.db.insert("courseStats", { key: deptKey, courseCount: 1 });
        }
      }
      processed += 1;
    }
    return processed;
  },
});

export const backfillSearchText = internalMutation({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    let updated = 0;
    for (const course of courses) {
      await ctx.db.patch(course._id, {
        searchText: buildCourseSearchText(course),
      });
      updated += 1;
    }
    return updated;
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const link of args.links) {
      const existing = await ctx.db
        .query("courseProfessors")
        .withIndex("by_courseId_and_professorId", (q) =>
          q.eq("courseId", link.courseId).eq("professorId", link.professorId),
        )
        .first();
      if (!existing) {
        await ctx.db.insert("courseProfessors", link);
      }
    }
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
        classStartMin: v.optional(v.number()),
        classEndMin: v.optional(v.number()),
        buildingName: v.string(),
        roomNumber: v.string(),
        days: v.array(v.number()),
        refreshedAt: v.number(),
        instructorTBD: v.boolean(),
        isOnline: v.boolean(),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let processed = 0;
    for (const section of args.sections) {
      const existing = await ctx.db
        .query("sections")
        .withIndex("by_externalId_and_termCode", (q) =>
          q.eq("externalId", section.externalId).eq("termCode", section.termCode),
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
    ratings: v.array(vv.doc("ratings").omit("_id", "_creationTime")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const rating of args.ratings) {
      const existingLookup = getExistingRatingLookup(rating);
      if (existingLookup?.indexName === "by_rmpId") {
        const existing = await ctx.db
          .query("ratings")
          .withIndex("by_rmpId", (q) => q.eq("rmpId", existingLookup.value))
          .first();
        if (existing) {
          continue;
        }
      }

      if (existingLookup?.indexName === "by_rmpLegacyId") {
        const existing = await ctx.db
          .query("ratings")
          .withIndex("by_rmpLegacyId", (q) => q.eq("rmpLegacyId", existingLookup.value))
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
  },
});

export const recomputeCourseSectionFilters = internalMutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
      .collect();

    const termCodes = [...new Set(sections.map((s) => s.termCode))];
    const professorIds = [
      ...new Set(sections.map((s) => s.professorId).filter((id): id is Id<"professors"> => !!id)),
    ];
    const days = [...new Set(sections.flatMap((s) => s.days))].sort((a, b) => a - b);

    await ctx.db.patch(args.courseId, {
      sectionTermCodes: termCodes,
      sectionProfessorIds: professorIds,
      sectionDays: days,
    });
  },
});

export const recomputeProfessorAggregates = internalMutation({
  args: { professorId: v.id("professors") },
  handler: async (ctx, args) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_professorId", (q) => q.eq("professorId", args.professorId))
      .collect();
    const ratingCount = ratings.length;
    if (ratingCount === 0) {
      await ctx.db.patch(args.professorId, {
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
    await ctx.db.patch(args.professorId, {
      ratingCount,
      avgDifficulty,
      avgQuality,
    });
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
    }),
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

  handler: async (ctx, args) => {
    const courses = await asyncMap(args.codes, (code) =>
      ctx.db
        .query("courses")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first(),
    );
    return courses.filter((course): course is NonNullable<typeof course> => !!course);
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
    }),
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

export const listAllCourseIds = internalQuery({
  args: {},
  returns: v.array(v.id("courses")),
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    return courses.map((course) => course._id);
  },
});

export const listProfessorsWithRmpId = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("professors"),
      rmpId: v.string(),
    }),
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
    }),
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

export const listAllProfessorIds = internalQuery({
  args: {},
  returns: v.array(v.id("professors")),
  handler: async (ctx) => {
    const professors = await ctx.db.query("professors").collect();
    return professors.map((professor) => professor._id);
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
    }),
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
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let updated = 0;
    for (const update of args.updates) {
      const professor = await ctx.db
        .query("professors")
        .withIndex("by_externalId", (q) => q.eq("externalId", update.externalId))
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
