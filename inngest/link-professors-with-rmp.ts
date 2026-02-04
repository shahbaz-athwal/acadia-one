import { NonRetriableError } from "inngest";
import { db } from "../services/db";
import { scraper } from "../services/rmp";
import { matchProfessorsWithRMP } from "../utils/ai-matcher";
import { RMP_ACADIA_ID } from "../utils/constants";
import { inngest } from "./client";

export const linkProfessorsWithRmp = inngest.createFunction(
  {
    id: "link-professors-with-rmp",
    singleton: {
      key: "link-professors-with-rmp",
      mode: "skip",
    },
  },
  { event: "sync/link-professors-with-rmp" },
  async ({ step }) => {
    // Steps 1: Fetch professors and RMP professors in parallel
    const [professors, rmpProfessors] = await Promise.all([
      step.run("fetch-professors", async () => {
        return await db.professor.findMany({
          where: { rmpId: null },
          select: {
            id: true,
            name: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        });
      }),
      step.run("fetch-rmp-professors", async () => {
        return await scraper.searchTeachersBySchoolId(RMP_ACADIA_ID);
      }),
    ]);

    if (professors.length === 0) {
      throw new NonRetriableError("No professors to link");
    }

    // Step 2: Format professors for matching
    const formattedProfessors = await step.run("format-professors", () => {
      return professors.map((professor) => ({
        id: professor.id,
        name: professor.name,
        department: professor.department.name,
      }));
    });

    // Step 3: AI Extracted Matches
    const matchesWithRmpId = await step.run("match-professors", async () => {
      const matches = await matchProfessorsWithRMP(
        formattedProfessors,
        rmpProfessors
      );
      return matches.filter((match) => match.rmpId !== null);
    });

    if (matchesWithRmpId.length === 0) {
      throw new NonRetriableError("No professors to link with RMP");
    }

    // Step 4: Update professors in database
    await step.run("update-professors", async () => {
      await Promise.all(
        matchesWithRmpId.map((match) =>
          db.professor.update({
            where: { id: match.professorId },
            data: { rmpId: match.rmpId },
          })
        )
      );

      return matchesWithRmpId.length;
    });
  }
);
