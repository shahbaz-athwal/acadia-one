"use node";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { parseCanonicalCourseCode } from "../lib/courseCode";
import { scraper as rmpScraper } from "../lib/rmp";

const toOptional = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

export const normalizeRmpCourseCode = (courseCode: string | null | undefined) =>
  parseCanonicalCourseCode(courseCode) ?? undefined;

interface PullRmpReviewsArgs {
  professorId: Id<"professors">;
  rmpId: string;
}

async function pullRmpReviewsInternal(ctx: ActionCtx, args: PullRmpReviewsArgs) {
  const { professorId, rmpId } = args;
  const ratings = await rmpScraper.getAllTeacherRatings({ teacherId: rmpId });

  if (ratings.length === 0) {
    return 0;
  }

  const courseCodes = [
    ...new Set(
      ratings
        .map((rating) => normalizeRmpCourseCode(rating.courseCode))
        .filter((code): code is string => !!code),
    ),
  ];

  if (courseCodes.length === 0) {
    return 0;
  }

  const courses = await ctx.runQuery(internal.internal.getCoursesByCodes, {
    codes: courseCodes,
  });
  if (courses.length === 0) {
    return 0;
  }

  const professor = await ctx.runQuery(internal.internal.getProfessorById, {
    id: professorId,
  });
  if (!professor) {
    return 0;
  }

  const courseByCode = new Map(courses.map((course) => [course.code, course]));
  const uniqueCourses = new Map<Id<"courses">, (typeof courses)[number]>();
  for (const rating of ratings) {
    const courseCode = normalizeRmpCourseCode(rating.courseCode);
    if (!courseCode) {
      continue;
    }
    const course = courseByCode.get(courseCode);
    if (course) {
      uniqueCourses.set(course._id, course);
    }
  }

  if (uniqueCourses.size > 0) {
    await ctx.runMutation(internal.internal.upsertCourseProfessors, {
      links: [...uniqueCourses.values()].map((course) => ({
        courseId: course._id,
        courseExternalId: course.externalId,
        professorId,
        professorExternalId: professor.externalId,
      })),
    });
  }

  const ratingsToCreate = ratings.flatMap((rating) => {
    const courseCode = normalizeRmpCourseCode(rating.courseCode);
    if (!courseCode) {
      return [];
    }
    const course = courseByCode.get(courseCode);
    if (!course) {
      return [];
    }
    return [
      {
        rmpId: rating.id,
        rmpLegacyId: rating.rmpLegacyId,
        status: "APPROVED",
        quality: rating.quality,
        difficulty: rating.difficulty,
        isForCredit: toOptional(rating.isForCredit),
        comment: toOptional(rating.comment),
        textBookRequired: toOptional(rating.textBookRequired),
        attendanceRequired: rating.attendanceRequired,
        gradeReceived: toOptional(rating.gradeReceived),
        wouldTakeAgain: toOptional(rating.wouldTakeAgain),
        thumbsUpTotal: rating.thumbsUpTotal,
        thumbsDownTotal: rating.thumbsDownTotal,
        tags: rating.tags,
        professorId,
        courseId: course._id,
        postedAt: rating.postedAt.getTime(),
      },
    ];
  });

  if (ratingsToCreate.length === 0) {
    return 0;
  }

  const created = await ctx.runMutation(internal.internal.insertRatings, {
    ratings: ratingsToCreate,
  });

  if (created > 0) {
    const courseIds = [...new Set(ratingsToCreate.map((rating) => rating.courseId))];
    for (const courseId of courseIds) {
      await ctx.runMutation(internal.internal.recomputeCourseAggregates, {
        courseId,
      });
    }
    await ctx.runMutation(internal.internal.recomputeProfessorAggregates, {
      professorId,
    });
  }

  await ctx.runMutation(internal.internal.updateProfessorLastPullFromRmp, {
    professorId,
    lastPullFromRmp: Date.now(),
  });

  return created;
}

export const pullRmpReviews = internalAction({
  args: {
    professorId: v.id("professors"),
    rmpId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const result = await pullRmpReviewsInternal(ctx, args);
    return `Created ${result} ratings.`;
  },
});

export const triggerRmpReviewsPulling = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const professors = await ctx.runQuery(internal.internal.listProfessorsWithRmpId);

    for (const [index, professor] of professors.entries()) {
      await ctx.scheduler.runAfter(index * 1000, internal.workflow.pullReviews.pullRmpReviews, {
        professorId: professor._id,
        rmpId: professor.rmpId,
      });
    }

    return `Scheduled ${professors.length} professors for RMP review pulling.`;
  },
});
