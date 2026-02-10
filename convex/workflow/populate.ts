import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { getAcadiaScraper } from "../acadia/scraper";

const FACULTY_FETCH_DELAY_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface PopulateDepartmentsResult {
  processed: number;
  message: string;
}

interface PopulateCoursesResult {
  processed: number;
  message: string;
}

interface PopulateProfessorsResult {
  processed: number;
  departments: number;
  message: string;
}

// Tested ✅
export const populateDepartments = internalAction({
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
export const populateCourses = internalAction({
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
export const populateProfessors = internalAction({
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
