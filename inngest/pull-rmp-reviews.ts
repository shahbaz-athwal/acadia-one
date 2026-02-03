import { NonRetriableError } from "inngest";
import { db } from "../services/db";
import { scraper } from "../services/rmp";
import { inngest } from "./client";

export const pullRmpReviews = inngest.createFunction(
  {
    id: "pull-rmp-reviews",
  },
  { event: "rmp/pull-reviews" },
  async ({ event, step }) => {
    const { rmpId, professorId } = event.data;

    // Step 1: Fetch ratings from RMP API
    const { ratings } = await step.run("fetch-ratings", async () => {
      return await scraper.getTeacherRatings({ teacherId: rmpId });
    });

    if (ratings.length === 0) {
      throw new NonRetriableError("No ratings found");
    }

    // Step 2: Match courses by code
    const courseCodeToId = await step.run("match-courses", async () => {
      const courseCodes = [
        ...new Set(
          ratings
            .map((r) => r.courseCode)
            .filter((code): code is string => !!code)
        ),
      ];

      if (courseCodes.length === 0) {
        throw new NonRetriableError("No courses found");
      }

      const courses = await db.course.findMany({
        where: { code: { in: courseCodes } },
        select: { id: true, code: true },
      });

      return Object.fromEntries(courses.map((c) => [c.code, c.id]));
    });

    // Step 3: Link professor to courses (if not already linked)
    await step.run("link-professor-courses", async () => {
      const courseIds = [
        ...new Set(
          ratings
            .filter((r) => r.courseCode && courseCodeToId[r.courseCode])
            // biome-ignore lint/style/noNonNullAssertion: filtered above
            .map((r) => courseCodeToId[r.courseCode!]!)
        ),
      ];

      await db.courseProfessor.createMany({
        data: courseIds.map((courseId) => ({
          courseId,
          professorId,
        })),
        skipDuplicates: true,
      });
    });

    // Step 4: Create ratings (only for courses that exist)
    const result = await step.run("create-ratings", async () => {
      const ratingsToCreate = ratings
        .filter((r) => r.courseCode && courseCodeToId[r.courseCode])
        .map((r) => ({
          rmpId: r.id,
          professorId,
          // biome-ignore lint/style/noNonNullAssertion: shut up
          courseId: courseCodeToId[r.courseCode!]!,
          quality: r.quality,
          difficulty: r.difficulty,
          isForCredit: r.isForCredit,
          comment: r.comment,
          textBookRequired: r.textBookRequired,
          attendanceRequired: r.attendanceRequired,
          gradeReceived: r.gradeReceived,
          wouldTakeAgain: r.wouldTakeAgain,
          thumbsUpTotal: r.thumbsUpTotal,
          thumbsDownTotal: r.thumbsDownTotal,
          tags: r.tags,
          postedAt: r.postedAt,
          status: "APPROVED" as const,
        }));

      if (ratingsToCreate.length === 0) {
        throw new NonRetriableError("No ratings to create");
      }

      return await db.rating.createMany({
        data: ratingsToCreate,
        skipDuplicates: true,
      });
    });

    // Step 5: Update professor's lastPullFromRmp
    await step.run("update-professor", async () => {
      await db.professor.update({
        where: { id: professorId },
        data: { lastPullFromRmp: new Date() },
      });
    });

    return {
      message: `Created ${result.count} ratings`,
      created: result.count,
      discarded: ratings.length - result.count,
    };
  }
);
