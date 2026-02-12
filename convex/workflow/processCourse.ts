"use node";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { getAcadiaScraper } from "../acadia/scraper";

const toTimestamp = (value: string) => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
};

type AcadiaScraperInstance = Awaited<ReturnType<typeof getAcadiaScraper>>;

interface ProcessCourseResult {
  message: string;
  sectionsProcessed: number;
  sectionsUpserted: number;
}

interface TriggerCourseProcessingResult {
  processedCourses: number;
  totalCourses: number;
  message: string;
}

/**
 * Processes a course by pulling detailed section data from the Acadia scraper, upserting associated terms,
 * professors, course-professor links, and section records into the database. Also updates the course's
 * last section pull timestamp. Returns the number of sections processed and upserted.
 */
async function processCourseInternal(
  ctx: ActionCtx,
  scraper: AcadiaScraperInstance,
  args: {
    courseId: Id<"courses">;
    courseExternalId: string;
    sectionIds: string[];
    departmentPrefix: string;
  }
) {
  const { courseId, courseExternalId, sectionIds, departmentPrefix } = args;
  const sections = await scraper.getSectionDetails(
    courseExternalId,
    sectionIds
  );

  const uniqueTerms = [
    ...new Map(
      sections.map((section) => [section.term.code, section.term])
    ).values(),
  ];
  await ctx.runMutation(internal.internal.upsertTerms, {
    terms: uniqueTerms.map((term) => ({
      code: term.code,
      name: term.name,
      isActive: term.isActive,
      startDate: toTimestamp(term.startDate),
      endDate: toTimestamp(term.endDate),
    })),
  });

  const uniqueInstructors = [
    ...new Map(
      sections
        .flatMap((section) => section.instructors)
        .map((instructor) => [instructor.id, instructor])
    ).values(),
  ];
  await ctx.runMutation(internal.internal.upsertProfessors, {
    professors: uniqueInstructors.map((instructor) => ({
      externalId: instructor.id,
      name: instructor.name,
      departmentPrefix,
    })),
  });

  const professorIds = await Promise.all(
    uniqueInstructors.map(async (instructor) => {
      const professor = await ctx.runQuery(
        internal.internal.getProfessorByExternalId,
        {
          externalId: instructor.id,
        }
      );
      return professor ? [instructor.id, professor._id] : null;
    })
  );
  const professorIdByExternalId = new Map(
    professorIds.filter(
      (entry): entry is [string, Id<"professors">] => entry !== null
    )
  );

  const courseProfessorLinks = uniqueInstructors
    .map((instructor) => {
      const professorId = professorIdByExternalId.get(instructor.id);
      if (!professorId) {
        return null;
      }
      return {
        courseId,
        professorId,
        courseExternalId,
        professorExternalId: instructor.id,
      };
    })
    .filter((link): link is NonNullable<typeof link> => link !== null);

  if (courseProfessorLinks.length > 0) {
    await ctx.runMutation(internal.internal.upsertCourseProfessors, {
      links: courseProfessorLinks,
    });
  }

  const refreshedAt = Date.now();
  const sectionsPayload = sections.flatMap((section) => {
    const meetingTime = section.meetingTimes[0];
    if (!meetingTime) {
      return [];
    }
    const instructor = section.instructors[0];
    const professorId = instructor
      ? professorIdByExternalId.get(instructor.id)
      : undefined;
    return [
      {
        externalId: section.id,
        termCode: section.term.code,
        courseId,
        courseExternalId,
        professorId,
        sectionCode: section.sectionCode,
        sectionSearchName: section.sectionSearchName,
        classStartTime: meetingTime.startTime,
        classEndTime: meetingTime.endTime,
        buildingName: meetingTime.buildingName,
        roomNumber: meetingTime.roomNumber,
        days: meetingTime.days,
        refreshedAt,
        instructorTBD: !instructor,
        isOnline: meetingTime.isOnline,
      },
    ];
  });

  await ctx.runMutation(internal.internal.upsertSections, {
    sections: sectionsPayload,
  });
  await ctx.runMutation(internal.internal.recomputeCourseSectionFilters, {
    courseId,
  });
  await ctx.runMutation(internal.internal.updateCourseLastSectionPulledAt, {
    courseId,
    lastSectionPulledAt: refreshedAt,
  });

  return {
    sectionsProcessed: sections.length,
    sectionsUpserted: sectionsPayload.length,
  };
}

export const processCourse = internalAction({
  args: {
    courseId: v.id("courses"),
    courseExternalId: v.string(),
    sectionIds: v.array(v.string()),
    departmentPrefix: v.string(),
  },
  handler: async (ctx, args): Promise<ProcessCourseResult> => {
    const scraper = await getAcadiaScraper(ctx);
    const result = await processCourseInternal(ctx, scraper, args);
    return {
      message: `Processed ${result.sectionsProcessed} sections.`,
      sectionsProcessed: result.sectionsProcessed,
      sectionsUpserted: result.sectionsUpserted,
    };
  },
});

export const triggerCourseProcessing = internalAction({
  args: {},
  handler: async (ctx): Promise<TriggerCourseProcessingResult> => {
    const courses = await ctx.runQuery(
      internal.internal.listCoursesForProcessing
    );
    let processedCourses = 0;

    for (const [index, course] of courses.entries()) {
      await ctx.scheduler.runAfter(
        index * 500,
        internal.workflow.processCourse.processCourse,
        {
          courseId: course._id,
          courseExternalId: course.externalId,
          sectionIds: course.matchingSectionIds,
          departmentPrefix: course.departmentPrefix,
        }
      );
      processedCourses += 1;
    }

    const message = `Scheduled ${processedCourses} course processing actions.`;
    await ctx.runMutation(internal.internal.insertLog, { message });
    return {
      processedCourses,
      totalCourses: courses.length,
      message,
    };
  },
});
