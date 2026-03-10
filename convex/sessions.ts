import { v } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getOneFrom } from "convex-helpers/server/relationships";
import { literals } from "convex-helpers/validators";
import { mutation, query } from "./_generated/server";
import { vv } from "./schema";

function normalizeCourseCode(courseCode: string): string {
  return courseCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

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

export const getProgressSearchCourses = query({
  args: {
    sessionId: v.string(),
    tokenHash: v.string(),
  },
  returns: v.array(
    v.object({
      key: v.string(),
      courses: v.array(
        v.object({
          code: v.string(),
          title: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const [user, userData] = await Promise.all([
      getOneFrom(ctx.db, "acadiaUsers", "by_sessionId", args.sessionId),
      getOneFrom(ctx.db, "acadiaUserData", "by_sessionId", args.sessionId),
    ]);

    if (
      !user ||
      user.tokenHash !== args.tokenHash ||
      !userData?.programEvaluation
    ) {
      return [];
    }

    const courseStatusCodeSet = new Set(
      Object.keys(userData.coursePlanningStatuses ?? {}).map(
        normalizeCourseCode
      )
    );
    if (courseStatusCodeSet.size === 0) {
      return [];
    }

    const searchGroupKeys = [
      ...new Set(
        userData.programEvaluation.requirements.flatMap((requirement) =>
          requirement.subrequirements.flatMap((subrequirement) =>
            subrequirement.groups
              .filter((group) => group.courses.length === 0)
              .map(
                (group) =>
                  `${requirement.code}:${subrequirement.id}:${group.id}`
              )
          )
        )
      ),
    ];
    if (searchGroupKeys.length === 0) {
      return [];
    }

    const entries = await asyncMap(searchGroupKeys, (key) =>
      getOneFrom(ctx.db, "rsg", "by_key", key)
    );

    const matchedCodesByKey = new Map<string, string[]>();
    const matchedCourseCodes = new Set<string>();

    for (const [index, entry] of entries.entries()) {
      if (!entry || entry.type !== "search") {
        continue;
      }

      const codesForKey: string[] = [];
      const seenCodesForKey = new Set<string>();
      for (const courseCode of entry.courseCodes) {
        const normalizedCourseCode = normalizeCourseCode(courseCode);
        if (
          !courseStatusCodeSet.has(normalizedCourseCode) ||
          seenCodesForKey.has(normalizedCourseCode)
        ) {
          continue;
        }

        seenCodesForKey.add(normalizedCourseCode);
        matchedCourseCodes.add(normalizedCourseCode);
        codesForKey.push(normalizedCourseCode);
      }

      if (codesForKey.length > 0) {
        matchedCodesByKey.set(searchGroupKeys[index], codesForKey);
      }
    }

    if (matchedCourseCodes.size === 0) {
      return [];
    }

    const matchedCourses = await asyncMap(
      [...matchedCourseCodes],
      (courseCode) => getOneFrom(ctx.db, "courses", "by_code", courseCode)
    );
    const courseTitleByCode = new Map(
      matchedCourses
        .filter((course): course is NonNullable<typeof course> => !!course)
        .map((course) => [course.code, course.title])
    );

    return searchGroupKeys.flatMap((key) => {
      const courseCodes = matchedCodesByKey.get(key);
      if (!courseCodes || courseCodes.length === 0) {
        return [];
      }

      return [
        {
          key,
          courses: courseCodes.map((code) => ({
            code,
            title: courseTitleByCode.get(code),
          })),
        },
      ];
    });
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
