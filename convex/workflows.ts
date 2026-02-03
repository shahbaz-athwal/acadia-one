"use node";

import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { getAcadiaScraper } from "./lib/acadia";
import { matchProfessorsWithRMP } from "./lib/aiMatcher";
import { RMP_ACADIA_ID } from "./lib/constants";
import { scraper as rmpScraper } from "./lib/rmp";

const FACULTY_FETCH_DELAY_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toTimestamp = (value: string) => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
};

const toOptional = <T>(value: T | null | undefined): T | undefined =>
  value ?? undefined;

type LockedResult = {
  skipped: boolean;
  message: string;
};

type PopulateDepartmentsResult = LockedResult & {
  processed: number;
};

type PopulateCoursesResult = LockedResult & {
  processed: number;
};

type PopulateProfessorsResult = LockedResult & {
  processed: number;
  departments: number;
};

type ProcessCourseResult = {
  skipped: false;
  message: string;
  sectionsProcessed: number;
  sectionsUpserted: number;
};

type TriggerCourseProcessingResult = LockedResult & {
  processedCourses: number;
  totalCourses: number;
};

type LinkProfessorsWithRmpResult = LockedResult & {
  matched: number;
};

type PullRmpReviewsArgs = {
  professorId: Id<"professors">;
  rmpId: string;
};

type PullRmpReviewsResult = {
  skipped: false;
  message: string;
  created: number;
  discarded: number;
};

type TriggerRmpReviewsPullingResult = LockedResult & {
  processedProfessors: number;
  totalProfessors: number;
  created: number;
  discarded: number;
};

const lockSkipMessage = (key: string) =>
  `Skipped "${key}" because another run is in progress.`;

async function withJobLock<T extends LockedResult>(
  ctx: ActionCtx,
  key: string,
  skippedResult: T,
  run: () => Promise<T>
): Promise<T> {
  const acquired = await ctx.runMutation(internal.jobLocks.tryAcquire, { key });
  if (!acquired) {
    return skippedResult;
  }
  try {
    return await run();
  } finally {
    await ctx.runMutation(internal.jobLocks.release, { key });
  }
}

async function processCourseInternal(
  ctx: ActionCtx,
  scraper: ReturnType<typeof getAcadiaScraper>,
  args: {
    courseId: Id<"courses">;
    courseExternalId: string;
    sectionIds: string[];
    departmentPrefix: string;
  }
): Promise<{ sectionsProcessed: number; sectionsUpserted: number }> {
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
  await ctx.runMutation(internal.internal.updateCourseLastSectionPulledAt, {
    courseId,
    lastSectionPulledAt: refreshedAt,
  });

  return {
    sectionsProcessed: sections.length,
    sectionsUpserted: sectionsPayload.length,
  };
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

export const populateDepartments = action({
  args: {},
  handler: async (ctx): Promise<PopulateDepartmentsResult> =>
    withJobLock<PopulateDepartmentsResult>(
      ctx,
      "populate-departments",
      {
        skipped: true,
        processed: 0,
        message: lockSkipMessage("populate-departments"),
      },
      async () => {
        const scraper = getAcadiaScraper();
        const departments = await scraper.getAllDepartments();
        const processed = await ctx.runMutation(
          internal.internal.upsertDepartments,
          {
            departments: departments.map((department) => ({
              prefix: department.prefix,
              name: department.name,
            })),
          }
        );
        const message = `Populated ${processed} departments.`;
        await ctx.runMutation(internal.internal.insertLog, { message });
        return { skipped: false, processed, message };
      }
    ),
});

export const populateCourses = action({
  args: {},
  handler: async (ctx): Promise<PopulateCoursesResult> =>
    withJobLock<PopulateCoursesResult>(
      ctx,
      "populate-courses",
      {
        skipped: true,
        processed: 0,
        message: lockSkipMessage("populate-courses"),
      },
      async () => {
        const scraper = getAcadiaScraper();
        const courses = await scraper.getAllCourses();
        const processed = await ctx.runMutation(
          internal.internal.upsertCourses,
          {
            courses: courses.map((course) => ({
              externalId: course.id,
              code: course.code,
              title: course.title,
              description: course.description || "",
              departmentPrefix: course.subjectCode,
              matchingSectionIds: course.matchingSectionIds,
              credits: course.credits,
              requisites: course.courseRequisites,
            })),
          }
        );
        const message = `Populated ${processed} courses.`;
        await ctx.runMutation(internal.internal.insertLog, { message });
        return { skipped: false, processed, message };
      }
    ),
});

export const populateProfessors = action({
  args: {},
  handler: async (ctx): Promise<PopulateProfessorsResult> =>
    withJobLock<PopulateProfessorsResult>(
      ctx,
      "populate-professors",
      {
        skipped: true,
        processed: 0,
        departments: 0,
        message: lockSkipMessage("populate-professors"),
      },
      async () => {
        const departments = await ctx.runQuery(api.departments.list);
        const scraper = getAcadiaScraper();
        const professors: Array<{
          externalId: string;
          name: string;
          departmentPrefix: string;
        }> = [];

        for (const department of departments) {
          await sleep(FACULTY_FETCH_DELAY_MS);
          const faculties = await scraper.getFacultiesByDepartment(
            department.prefix
          );
          for (const faculty of faculties) {
            professors.push({
              externalId: faculty.id,
              name: faculty.name,
              departmentPrefix: department.prefix,
            });
          }
        }

        const processed = await ctx.runMutation(
          internal.internal.upsertProfessors,
          {
            professors,
          }
        );
        const message = `Populated ${processed} professors in ${departments.length} departments.`;
        await ctx.runMutation(internal.internal.insertLog, { message });
        return {
          skipped: false,
          processed,
          departments: departments.length,
          message,
        };
      }
    ),
});

export const processCourse = action({
  args: {
    courseId: v.id("courses"),
    courseExternalId: v.string(),
    sectionIds: v.array(v.string()),
    departmentPrefix: v.string(),
  },
  handler: async (ctx, args): Promise<ProcessCourseResult> => {
    const scraper = getAcadiaScraper();
    const result = await processCourseInternal(ctx, scraper, args);
    return {
      skipped: false,
      message: `Processed ${result.sectionsProcessed} sections.`,
      sectionsProcessed: result.sectionsProcessed,
      sectionsUpserted: result.sectionsUpserted,
    };
  },
});

export const triggerCourseProcessing = action({
  args: {},
  handler: async (ctx): Promise<TriggerCourseProcessingResult> =>
    withJobLock<TriggerCourseProcessingResult>(
      ctx,
      "trigger-course-processing",
      {
        skipped: true,
        processedCourses: 0,
        totalCourses: 0,
        message: lockSkipMessage("trigger-course-processing"),
      },
      async () => {
        const courses = await ctx.runQuery(
          internal.internal.listCoursesForProcessing
        );
        const scraper = getAcadiaScraper();
        let processedCourses = 0;

        for (const course of courses) {
          await processCourseInternal(ctx, scraper, {
            courseId: course._id,
            courseExternalId: course.externalId,
            sectionIds: course.matchingSectionIds,
            departmentPrefix: course.departmentPrefix,
          });
          processedCourses += 1;
        }

        const message = `Processed ${processedCourses} courses.`;
        await ctx.runMutation(internal.internal.insertLog, { message });
        return {
          skipped: false,
          processedCourses,
          totalCourses: courses.length,
          message,
        };
      }
    ),
});

export const linkProfessorsWithRmp = action({
  args: {},
  handler: async (ctx): Promise<LinkProfessorsWithRmpResult> =>
    withJobLock<LinkProfessorsWithRmpResult>(
      ctx,
      "link-professors-with-rmp",
      {
        skipped: true,
        matched: 0,
        message: lockSkipMessage("link-professors-with-rmp"),
      },
      async () => {
        const professors: Array<{
          externalId: string;
          name: string;
          departmentPrefix: string;
        }> = await ctx.runQuery(internal.internal.listProfessorsWithoutRmpId);
        if (professors.length === 0) {
          return {
            skipped: false,
            matched: 0,
            message: "No professors without RMP IDs.",
          };
        }

        const departments = await ctx.runQuery(api.departments.list);
        const departmentByPrefix = new Map(
          departments.map((department) => [department.prefix, department.name])
        );

        const formattedProfessors = professors.map((professor) => ({
          id: professor.externalId,
          name: professor.name,
          department:
            departmentByPrefix.get(professor.departmentPrefix) ??
            professor.departmentPrefix,
        }));

        const rmpProfessors =
          await rmpScraper.searchTeachersBySchoolId(RMP_ACADIA_ID);
        const matches = await matchProfessorsWithRMP(
          formattedProfessors,
          rmpProfessors
        );

        const updates = matches
          .filter((match) => match.rmpId)
          .map((match) => ({
            externalId: match.professorId,
            rmpId: match.rmpId as string,
          }));

        if (updates.length === 0) {
          return {
            skipped: false,
            matched: 0,
            message: "No professors matched with RMP.",
          };
        }

        const matched = await ctx.runMutation(
          internal.internal.updateProfessorRmpIds,
          { updates }
        );

        return {
          skipped: false,
          matched,
          message: `Linked ${matched} professors with RMP.`,
        };
      }
    ),
});

export const pullRmpReviews = action({
  args: {
    professorId: v.id("professors"),
    rmpId: v.string(),
  },
  handler: async (ctx, args): Promise<PullRmpReviewsResult> => {
    const result = await pullRmpReviewsInternal(ctx, args);
    return {
      skipped: false,
      created: result.created,
      discarded: result.discarded,
      message: result.message,
    };
  },
});

export const triggerRmpReviewsPulling = action({
  args: {},
  handler: async (ctx): Promise<TriggerRmpReviewsPullingResult> =>
    withJobLock<TriggerRmpReviewsPullingResult>(
      ctx,
      "trigger-rmp-reviews-pulling",
      {
        skipped: true,
        processedProfessors: 0,
        totalProfessors: 0,
        created: 0,
        discarded: 0,
        message: lockSkipMessage("trigger-rmp-reviews-pulling"),
      },
      async () => {
        const professors: Array<{ _id: Id<"professors">; rmpId: string }> =
          await ctx.runQuery(internal.internal.listProfessorsWithRmpId);
        let processedProfessors = 0;
        let created = 0;
        let discarded = 0;

        for (const professor of professors) {
          const result = await pullRmpReviewsInternal(ctx, {
            professorId: professor._id,
            rmpId: professor.rmpId,
          });
          processedProfessors += 1;
          created += result.created;
          discarded += result.discarded;
        }

        const message = `Processed ${processedProfessors} professors for RMP reviews.`;
        await ctx.runMutation(internal.internal.insertLog, { message });
        return {
          skipped: false,
          processedProfessors,
          totalProfessors: professors.length,
          created,
          discarded,
          message,
        };
      }
    ),
});
