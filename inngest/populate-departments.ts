import { scraper } from "../services/acadia/scraper";
import { db } from "../services/db";
import { inngest } from "./client";

export const populateDepartments = inngest.createFunction(
  {
    id: "populate-departments",
    singleton: {
      key: "populate-departments",
      mode: "skip",
    },
  },
  { event: "populate/departments" },
  async ({ step }) => {
    // Step 1: Fetch all departments from Acadia
    const departments = await step.run("fetch-departments", async () => {
      return await scraper.getAllDepartments();
    });

    // Step 2: Insert all departments
    const createdDepartments = await step.run(
      "insert-departments",
      async () => {
        return await db.department.createMany({
          data: departments.map((department) => ({
            prefix: department.prefix,
            name: department.name,
          })),
          skipDuplicates: true,
        });
      }
    );

    // Step 3: Insert log
    const message = `Populated ${createdDepartments.count} departments`;
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
