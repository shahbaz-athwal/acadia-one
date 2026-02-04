import { scraper } from "../services/acadia/scraper";
import { db } from "../services/db";
import { inngest } from "./client";

export const processCourse = inngest.createFunction(
  {
    id: "process-course",
    description:
      "Pull and populates sections and instructors for a course.\n" +
      "- Triggered by the `courses/trigger-processing` event\n" +
      "- Fetches section details from Acadia\n" +
      "- Collects all unique instructors across all terms and sections\n" +
      "- Upserts all professors\n" +
      "- Links all instructors to the course\n" +
      "- Upserts all sections",
    throttle: {
      limit: 10,
      period: "10s",
    },
  },
  { event: "course/process" },
  async ({ event, step }) => {
    const { courseId, sectionIds, departmentPrefix } = event.data;

    // Step 1: Fetch section details from Acadia
    const sections = await step.run("fetch-sections", async () => {
      return await scraper.getSectionDetails(courseId, sectionIds);
    });

    // Step 2: Upsert terms
    await step.run("upsert-terms", async () => {
      const uniqueTerms = [
        ...new Map(sections.map((s) => [s.term.code, s.term])).values(),
      ];
      await db.term.createMany({
        data: uniqueTerms.map((t) => ({
          code: t.code,
          name: t.name,
          isActive: t.isActive,
          startDate: t.startDate,
          endDate: t.endDate,
        })),
        skipDuplicates: true,
      });
    });

    // Step 3: Upsert professors
    await step.run("upsert-professors", async () => {
      const uniqueInstructors = [
        ...new Map(
          sections.flatMap((s) => s.instructors).map((i) => [i.id, i])
        ).values(),
      ];
      await db.professor.createMany({
        data: uniqueInstructors.map((i) => ({
          id: i.id,
          name: i.name,
          departmentPrefix,
        })),
        skipDuplicates: true,
      });
    });

    // Step 4: Link professors to course
    await step.run("link-professors-to-course", async () => {
      const uniqueInstructorIds = [
        ...new Set(sections.flatMap((s) => s.instructors.map((i) => i.id))),
      ];
      await db.courseProfessor.createMany({
        data: uniqueInstructorIds.map((profId) => ({
          courseId,
          professorId: profId,
        })),
        skipDuplicates: true,
      });
    });

    // Step 5: Upsert sections
    await step.run("upsert-sections", async () => {
      const sectionData = sections.flatMap((s) => {
        const meetingTime = s.meetingTimes[0];
        const instructor = s.instructors[0];
        if (!meetingTime) {
          return [];
        }
        return [
          {
            id: s.id,
            termCode: s.term.code,
            sectionCode: s.sectionCode,
            sectionSearchName: s.sectionSearchName,
            classStartTime: meetingTime.startTime,
            classEndTime: meetingTime.endTime,
            buildingName: meetingTime.buildingName,
            roomNumber: meetingTime.roomNumber,
            days: meetingTime.days,
            courseId,
            professorId: instructor?.id ?? null,
            instructorTBD: !instructor,
            refreshedAt: new Date(),
            isOnline: meetingTime.isOnline,
          },
        ];
      });

      // Delete and recreate for clean refresh
      // await db.section.deleteMany({ where: { courseId } }); // TODO: Uncomment this when we want to delete all sections for a course
      await db.section.createMany({ data: sectionData });
    });

    // Step 6: Update course lastSectionPulledAt
    await step.run("update-course-timestamp", async () => {
      await db.course.update({
        where: { id: courseId },
        data: { lastSectionPulledAt: new Date() },
      });
    });

    return { sectionsProcessed: sections.length };
  }
);
