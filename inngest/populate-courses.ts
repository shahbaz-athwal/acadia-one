import { scraper } from "../services/acadia/scraper";
import { db } from "../services/db";
import { inngest } from "./client";

export const populateCourses = inngest.createFunction(
  {
    id: "populate-courses",
    singleton: {
      key: "populate-courses",
      mode: "skip",
    },
  },
  { event: "courses/populate" },
  async ({ step }) => {
    // Step 1: Fetch all courses from scraper
    const courses = await step.run("fetch-courses", async () => {
      return await scraper.getAllCourses();
    });

    // Step 2: Insert courses into database
    const createdCourses = await step.run("insert-courses", async () => {
      return await db.course.createMany({
        data: courses.map((course) => ({
          id: course.id,
          code: course.code,
          title: course.title,
          description: course.description || "",
          departmentPrefix: course.subjectCode,
          matchingSectionIds: course.matchingSectionIds,
          credits: course.credits,
          requisites: course.courseRequisites,
        })),
        skipDuplicates: true,
      });
    });
    // Step 3: Insert log
    const message = `Populated ${createdCourses.count} courses`;
    await step.run("insert-log", async () => {
      return await db.log.create({
        data: {
          message,
        },
      });
    });

    return message;
  }
);
