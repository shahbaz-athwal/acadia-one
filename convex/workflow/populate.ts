"use node";
import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { getAcadiaScraper } from "../acadia/scraper";

const FACULTY_FETCH_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const populateDepartments = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const scraper = await getAcadiaScraper(ctx);
    const departments = await scraper.getAllDepartments();
    await ctx.runMutation(internal.internal.existsDepartments, {
      departments,
    });
    return `Populated ${departments.length} departments.`;
  },
});

export const populateCourses = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const scraper = await getAcadiaScraper(ctx);
    const courses = await scraper.getAllCourses();
    await ctx.runMutation(internal.internal.upsertCourses, {
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
    return `Populated ${courses.length} courses.`;
  },
});

export const populateProfessors = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
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

    await ctx.runMutation(internal.internal.existsProfessors, {
      professors,
    });
    return `Populated ${professors.length} professors in ${departments.length} departments.`;
  },
});
