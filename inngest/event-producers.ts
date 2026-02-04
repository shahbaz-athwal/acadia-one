import { db } from "../services/db";
import { inngest } from "./client";

export const triggerCourseProcessing = inngest.createFunction(
  {
    id: "trigger-course-processing",
    singleton: {
      key: "trigger-course-processing",
      mode: "skip",
    },
  },
  { event: "courses/trigger-processing" },
  async ({ step }) => {
    const courses = await step.run("fetch-courses-with-sections", async () => {
      return await db.course.findMany({
        where: {
          matchingSectionIds: { isEmpty: false },
        },
        select: {
          id: true,
          matchingSectionIds: true,
          departmentPrefix: true,
        },
      });
    });

    await step.sendEvent(
      "send-process-events",
      courses.map((course) => ({
        name: "course/process",
        data: {
          courseId: course.id,
          sectionIds: course.matchingSectionIds,
          departmentPrefix: course.departmentPrefix,
        },
      }))
    );

    const message = `Triggered processing for ${courses.length} courses`;
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

export const triggerRmpReviewsPulling = inngest.createFunction(
  {
    id: "trigger-rmp-reviews-pulling",
    singleton: {
      key: "trigger-rmp-reviews-pulling",
      mode: "skip",
    },
  },
  { event: "rmp/trigger-reviews-pulling" },
  async ({ step }) => {
    const professors = await step.run(
      "fetch-professors-with-rmp-id",
      async () => {
        return await db.professor.findMany({
          where: {
            rmpId: { not: null },
          },
          select: {
            rmpId: true,
          },
        });
      }
    );

    await step.sendEvent(
      "send-pull-reviews-events",
      professors.map((professor) => ({
        name: "rmp/pull-reviews",
        data: {
          rmpId: professor.rmpId as string,
        },
      }))
    );

    const message = `Triggered pulling reviews for ${professors.length} professors`;
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
