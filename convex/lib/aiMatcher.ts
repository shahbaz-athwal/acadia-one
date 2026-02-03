"use node";

import { google } from "@ai-sdk/google";
import { withTracing } from "@posthog/ai";
import { generateObject } from "ai";
import { z } from "zod";
import { AI_MAPPING_PROMPT } from "./constants";
import { posthog } from "./posthog";
import type { TeacherNode } from "./rmp";

const ProfessorMatchSchema = z.object({
  matches: z.array(
    z.object({
      professorId: z.string(),
      rmpId: z.string().nullable(),
    })
  ),
});

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
  const prompt = `${AI_MAPPING_PROMPT}
  Data:
  - Local Professors (from our database):
      ${JSON.stringify(localProfessors, null, 2)}
  - Rate My Professor Data:
      ${JSON.stringify(rmpProfessors, null, 2)}
  `;

  const result = await generateObject({
    model,
    schema: ProfessorMatchSchema,
    prompt,
  });

  await posthog.shutdown();

  return result.object.matches;
}
