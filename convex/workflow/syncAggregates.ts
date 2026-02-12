import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

interface SyncAggregateDocumentsResult {
  coursesSynced: number;
  professorsSynced: number;
  message: string;
}

export const syncAggregateDocuments = internalAction({
  args: {},
  returns: v.object({
    coursesSynced: v.number(),
    professorsSynced: v.number(),
    message: v.string(),
  }),
  handler: async (ctx): Promise<SyncAggregateDocumentsResult> => {
    const courseIds = await ctx.runQuery(internal.internal.listAllCourseIds);
    for (const courseId of courseIds) {
      await ctx.runMutation(internal.internal.recomputeCourseAggregates, {
        courseId,
      });
      await ctx.runMutation(internal.internal.recomputeCourseSectionFilters, {
        courseId,
      });
    }

    const professorIds = await ctx.runQuery(
      internal.internal.listAllProfessorIds
    );
    for (const professorId of professorIds) {
      await ctx.runMutation(internal.internal.recomputeProfessorAggregates, {
        professorId,
      });
    }

    return {
      coursesSynced: courseIds.length,
      professorsSynced: professorIds.length,
      message: `Synced aggregates for ${courseIds.length} courses and ${professorIds.length} professors.`,
    };
  },
});
