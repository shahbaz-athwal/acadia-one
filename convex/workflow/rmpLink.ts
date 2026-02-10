"use node";

import { google } from "@ai-sdk/google";
import { withTracing } from "@posthog/ai";
import { generateObject } from "ai";
import { z } from "zod";
import { api, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { AI_MAPPING_PROMPT, RMP_ACADIA_ID } from "../lib/constants";
import { posthog } from "../lib/posthog";
import { scraper as rmpScraper, type TeacherNode } from "../lib/rmp";

interface LinkProfessorsWithRmpResult {
  matched: number;
  message: string;
}

interface LocalProfessor {
  id: string;
  name: string;
  department: string;
}

const ProfessorMatchSchema = z.array(
  z.object({
    professorId: z.string(),
    rmpId: z.string().nullable(),
  })
);

const model = withTracing(google("gemini-pro-latest"), posthog, {});

async function matchProfessorsWithRMP(
  localProfessors: LocalProfessor[],
  rmpProfessors: TeacherNode[]
) {
  const formatLocalProfs = [...localProfessors]
    .sort((a, b) => a.department.localeCompare(b.department))
    .map((p) => `[ID: ${p.id}] ${p.name} - Dept: ${p.department}`)
    .join("\n");

  const formatRMPProfs = [...rmpProfessors]
    .sort((a, b) => a.department.localeCompare(b.department))
    .map(
      (p) =>
        `[RMP_ID: ${p.id}] ${p.firstName} ${p.lastName} - Dept: ${p.department}`
    )
    .join("\n");

  const prompt = `${AI_MAPPING_PROMPT}

Local Professors (from our database):
${formatLocalProfs}

Rate My Professor Data:
${formatRMPProfs}
`;

  const result = await generateObject({
    model,
    schema: ProfessorMatchSchema,
    prompt,
  });

  await posthog.shutdown();

  return result.object;
}

// Tested ✅
export const linkProfessorsWithRmp = internalAction({
  args: {},
  handler: async (ctx): Promise<LinkProfessorsWithRmpResult> => {
    const professors: Array<{
      externalId: string;
      name: string;
      departmentPrefix: string;
    }> = await ctx.runQuery(internal.internal.listAllProfessors);
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
