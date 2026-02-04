"use node";

import { google } from "@ai-sdk/google";
import { withTracing } from "@posthog/ai";
import { generateObject } from "ai";
import { z } from "zod";
import { AI_MAPPING_PROMPT } from "./constants";
import { posthog } from "./posthog";
import type { TeacherNode } from "./rmp";

const ProfessorMatchSchema = z.array(
  z.object({
    professorId: z.string(),
    rmpId: z.string().nullable(),
  })
);

type LocalProfessor = {
  id: string;
  name: string;
  department: string;
};

const model = withTracing(google("gemini-pro-latest"), posthog, {});

export async function matchProfessorsWithRMP(
  localProfessors: LocalProfessor[],
  rmpProfessors: TeacherNode[]
) {
  const formatLocalProfs = localProfessors
    .map((p) => `[ID: ${p.id}] ${p.name} - Dept: ${p.department}`)
    .join("\n");

  const formatRMPProfs = rmpProfessors
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
