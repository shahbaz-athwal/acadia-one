import type { ProfessorCreateManyInput } from "../../prisma/generated/models";
import { scraper } from "../services/acadia/scraper";
import { db } from "../services/db";
import { inngest } from "./client";

export const populateProfessors = inngest.createFunction(
  {
    id: "populate-professors",
    singleton: {
      key: "populate-professors",
      mode: "skip",
    },
    concurrency: 1,
  },
  { event: "populate/acadia-department-professors" },
  async ({ step }) => {
    // Step 1: Fetch departments to process
    const departments = await step.run("fetch-departments", async () => {
      return await db.department.findMany();
    });

    // Step 2: Fetch all faculties from all departments
    const facultiesByDepartment = new Map<
      string,
      { id: string; name: string }[]
    >();

    for (const department of departments) {
      const faculties = await step.run(
        `fetch-faculties-${department.prefix}`,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          return await scraper.getFacultiesByDepartment(department.prefix);
        }
      );
      facultiesByDepartment.set(department.prefix, faculties);
    }

    // Step 3: Insert all professors concurrently
    const createdProfessors = await step.run(
      "insert-all-professors",
      async () => {
        const allProfessors: ProfessorCreateManyInput[] = [];

        for (const [departmentPrefix, faculties] of facultiesByDepartment) {
          for (const faculty of faculties) {
            allProfessors.push({
              id: faculty.id,
              name: faculty.name,
              departmentPrefix,
            });
          }
        }

        return await db.professor.createMany({
          data: allProfessors,
          skipDuplicates: true,
        });
      }
    );

    // Step 4: Insert log
    const message = `Populated ${createdProfessors.count} professors in ${departments.length} departments`;
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
