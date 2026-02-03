"use node";

import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { getAcadiaScraper } from "./lib/acadia/scraper";
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

type AcadiaScraperInstance = Awaited<ReturnType<typeof getAcadiaScraper>>;

type PopulateDepartmentsResult = {
  processed: number;
  message: string;
};

type PopulateCoursesResult = {
  processed: number;
  message: string;
};

type PopulateProfessorsResult = {
  processed: number;
  departments: number;
  message: string;
};

type ProcessCourseResult = {
  message: string;
  sectionsProcessed: number;
  sectionsUpserted: number;
};

type TriggerCourseProcessingResult = {
  processedCourses: number;
  totalCourses: number;
  message: string;
};

type LinkProfessorsWithRmpResult = {
  matched: number;
  message: string;
};

type PullRmpReviewsArgs = {
  professorId: Id<"professors">;
  rmpId: string;
};

type PullRmpReviewsResult = {
  message: string;
  created: number;
  discarded: number;
};

type TriggerRmpReviewsPullingResult = {
  processedProfessors: number;
  totalProfessors: number;
  created: number;
  discarded: number;
  message: string;
};

async function processCourseInternal(
  ctx: ActionCtx,
  scraper: AcadiaScraperInstance,
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

// Tested ✅
export const populateDepartments = action({
  args: {},
  handler: async (ctx): Promise<PopulateDepartmentsResult> => {
    const scraper = await getAcadiaScraper(ctx);
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
    return { processed, message };
  },
});

// Tested ✅
export const populateCourses = action({
  args: {},
  handler: async (ctx): Promise<PopulateCoursesResult> => {
    const scraper = await getAcadiaScraper(ctx);
    const courses = await scraper.getAllCourses();
    const processed = await ctx.runMutation(internal.internal.upsertCourses, {
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
    });
    const message = `Populated ${processed} courses.`;
    await ctx.runMutation(internal.internal.insertLog, { message });
    return { processed, message };
  },
});

// Tested ✅
export const populateProfessors = action({
  args: {},
  handler: async (ctx): Promise<PopulateProfessorsResult> => {
    const departments = await ctx.runQuery(api.departments.list);
    const scraper = await getAcadiaScraper(ctx);
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
      processed,
      departments: departments.length,
      message,
    };
  },
});

export const processCourse = action({
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

export const triggerCourseProcessing = action({
  args: {},
  handler: async (ctx): Promise<TriggerCourseProcessingResult> => {
    const courses = await ctx.runQuery(
      internal.internal.listCoursesForProcessing
    );
    const scraper = await getAcadiaScraper(ctx);
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
      processedCourses,
      totalCourses: courses.length,
      message,
    };
  },
});

// Tested ✅
export const linkProfessorsWithRmp = action({
  args: {},
  handler: async (ctx): Promise<LinkProfessorsWithRmpResult> => {
    const professors: Array<{
      externalId: string;
      name: string;
      departmentPrefix: string;
    }> = await ctx.runQuery(internal.internal.listProfessorsWithoutRmpId);
    if (professors.length === 0) {
      return {
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

    const rmpProfessorById = new Map(
      rmpProfessors.map((professor) => [professor.id, professor])
    );
    const updates = matches
      .filter((match) => match.rmpId)
      .map((match) => {
        const rmpProfessor = rmpProfessorById.get(match.rmpId as string);
        if (!rmpProfessor) {
          return null;
        }
        return {
          externalId: match.professorId,
          rmpId: match.rmpId as string,
          rmpLegacyId: rmpProfessor.legacyId,
        };
      })
      .filter((update): update is NonNullable<typeof update> => !!update);

    if (updates.length === 0) {
      return {
        matched: 0,
        message: "No professors matched with RMP.",
      };
    }

    const matched = await ctx.runMutation(
      internal.internal.updateProfessorRmpIds,
      { updates }
    );

    return {
      matched,
      message: `Linked ${matched} professors with RMP.`,
    };
  },
});

export const pullRmpReviews = action({
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

export const triggerRmpReviewsPulling = action({
  args: {},
  handler: async (ctx): Promise<TriggerRmpReviewsPullingResult> => {
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
      processedProfessors,
      totalProfessors: professors.length,
      created,
      discarded,
      message,
    };
  },
});
