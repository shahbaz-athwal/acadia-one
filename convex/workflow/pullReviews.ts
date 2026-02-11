"use node";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { scraper as rmpScraper } from "../lib/rmp";

const toOptional = <T>(value: T | null | undefined): T | undefined =>
  value ?? undefined;

interface PullRmpReviewsArgs {
  professorId: Id<"professors">;
  rmpId: string;
}

interface PullRmpReviewsResult {
  message: string;
  created: number;
  discarded: number;
}

interface TriggerRmpReviewsPullingResult {
  processedProfessors: number;
  totalProfessors: number;
  message: string;
}

async function pullRmpReviewsInternal(
  ctx: ActionCtx,
  args: PullRmpReviewsArgs
): Promise<{ created: number; discarded: number; message: string }> {
  const { professorId, rmpId } = args;
  const { ratings } = await rmpScraper.getTeacherRatings({ teacherId: rmpId });

  if (ratings.length === 0) {
    return { created: 0, discarded: 0, message: "No ratings found." };
  }

  const courseCodes = [
    ...new Set(
      ratings
        .map((rating) => rating.courseCode)
        .filter((code): code is string => !!code)
    ),
  ];

  if (courseCodes.length === 0) {
    return {
      created: 0,
      discarded: ratings.length,
      message: "No course codes found in ratings.",
    };
  }

  const courses: Array<{
    _id: Id<"courses">;
    code: string;
    externalId: string;
  }> = await ctx.runQuery(internal.internal.getCoursesByCodes, {
    codes: courseCodes,
  });
  if (courses.length === 0) {
    return {
      created: 0,
      discarded: ratings.length,
      message: "No matching courses found.",
    };
  }

  const professor = await ctx.runQuery(internal.internal.getProfessorById, {
    id: professorId,
  });
  if (!professor) {
    return {
      created: 0,
      discarded: ratings.length,
      message: "Professor not found.",
    };
  }

  const courseByCode = new Map(courses.map((course) => [course.code, course]));
  const uniqueCourses = new Map<Id<"courses">, (typeof courses)[number]>();
  for (const rating of ratings) {
    if (!rating.courseCode) {
      continue;
    }
    const course = courseByCode.get(rating.courseCode);
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
    if (!rating.courseCode) {
      return [];
    }
    const course = courseByCode.get(rating.courseCode);
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
    return {
      created: 0,
      discarded: ratings.length,
      message: "No ratings to create for known courses.",
    };
  }

  const created = await ctx.runMutation(internal.internal.insertRatings, {
    ratings: ratingsToCreate,
  });

  if (created > 0) {
    const courseIds = [
      ...new Set(ratingsToCreate.map((rating) => rating.courseId)),
    ];
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

  return {
    created,
    discarded: ratings.length - created,
    message: `Created ${created} ratings.`,
  };
}

export const pullRmpReviews = internalAction({
  args: {
    professorId: v.id("professors"),
    rmpId: v.string(),
  },
  handler: async (ctx, args): Promise<PullRmpReviewsResult> => {
    const result = await pullRmpReviewsInternal(ctx, args);
    return {
      created: result.created,
      discarded: result.discarded,
      message: result.message,
    };
  },
});

export const triggerRmpReviewsPulling = internalAction({
  args: {},
  handler: async (ctx): Promise<TriggerRmpReviewsPullingResult> => {
    const professors: Array<{ _id: Id<"professors">; rmpId: string }> =
      await ctx.runQuery(internal.internal.listProfessorsWithRmpId);
    let processedProfessors = 0;

    for (const [index, professor] of professors.entries()) {
      await ctx.scheduler.runAfter(
        index * 1000,
        internal.workflow.pullReviews.pullRmpReviews,
        {
          professorId: professor._id,
          rmpId: professor.rmpId,
        }
      );
      processedProfessors += 1;
    }

    const message = `Scheduled ${processedProfessors} professors for RMP review pulling.`;
    await ctx.runMutation(internal.internal.insertLog, { message });
    return {
      processedProfessors,
      totalProfessors: professors.length,
      message,
    };
  },
});
