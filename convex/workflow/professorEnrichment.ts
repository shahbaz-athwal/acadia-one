"use node";

import { Agent } from "@convex-dev/agent";
import { v } from "convex/values";
import { z } from "zod";
import { api, components, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { geminiModel as model } from "../lib/aiModel";
import { AI_FACULTY_ENRICHMENT_PROMPT } from "../lib/constants";
import { posthog } from "../lib/posthog";
import {
  buildAgentCandidatePool,
  type DbProfessorMatchCandidate,
  type FacultyProfessor,
  resolveDeterministicMatches,
  resolveFacultyEnrichmentUpdates,
} from "../lib/professorEnrichment";

const FacultyProfessorMatchSchema = z.array(
  z.object({
    jsonName: z.string(),
    matchedExternalId: z.string().nullable(),
    confidence: z.enum(["high", "low", "none"]),
    reason: z.string(),
  })
);

const professorEnrichmentAgent = new Agent(components.agent, {
  name: "professor-faculty-enrichment",
  instructions: AI_FACULTY_ENRICHMENT_PROMPT,
  languageModel: model,
});

interface DepartmentEnrichmentResult {
  departmentPrefix: string;
  departmentName: string;
  total: number;
  autoMatched: number;
  agentMatched: number;
  updated: number;
  skippedNoMatch: number;
  skippedLowConfidence: number;
  skippedNoData: number;
  warnings: string[];
  unmatchedNames: string[];
}

function formatFacultyProfessor(professor: FacultyProfessor) {
  return [
    `Name: ${professor.name}`,
    `Title: ${professor.title || "N/A"}`,
    `Email: ${professor.email || "N/A"}`,
    `Phone: ${professor.phone || "N/A"}`,
    `Office: ${professor.office || "N/A"}`,
    `Website: ${professor.profile_url || "N/A"}`,
    `Source URL: ${professor.source_url || "N/A"}`,
  ].join("\n");
}

function formatDbProfessor(
  professor: DbProfessorMatchCandidate,
  departmentNameByPrefix: Map<string, string>
) {
  const departmentName =
    departmentNameByPrefix.get(professor.departmentPrefix) ??
    professor.departmentPrefix;
  return `[EXTERNAL_ID: ${professor.externalId}] ${professor.name} - Dept: ${departmentName} (${professor.departmentPrefix})`;
}

async function matchFacultyProfessorsWithAgent(
  thread: NonNullable<
    Awaited<
      ReturnType<typeof professorEnrichmentAgent.continueThread>
    >["thread"]
  >,
  args: {
    departmentPrefix: string;
    departmentName: string;
    professors: FacultyProfessor[];
    dbCandidates: DbProfessorMatchCandidate[];
    departmentNameByPrefix: Map<string, string>;
  }
) {
  const formattedFacultyProfessors = args.professors
    .map((professor) => formatFacultyProfessor(professor))
    .join("\n\n---\n\n");
  const formattedDbCandidates = args.dbCandidates
    .sort((a, b) => {
      if (a.departmentPrefix === b.departmentPrefix) {
        return a.name.localeCompare(b.name);
      }
      return a.departmentPrefix.localeCompare(b.departmentPrefix);
    })
    .map((professor) =>
      formatDbProfessor(professor, args.departmentNameByPrefix)
    )
    .join("\n");

  const prompt = `
Department: ${args.departmentName} (${args.departmentPrefix})

Faculty directory professors to match:
${formattedFacultyProfessors}

Database professor candidates:
${formattedDbCandidates}
`;

  const result = await thread.generateObject({
    prompt,
    schema: FacultyProfessorMatchSchema,
  });

  return result.object;
}

export const enrichDepartmentProfessors = internalAction({
  args: {
    departmentPrefix: v.string(),
    departmentName: v.string(),
    warnings: v.array(v.string()),
    professors: v.array(
      v.object({
        prefix: v.string(),
        department: v.string(),
        source_url: v.string(),
        name: v.string(),
        title: v.string(),
        email: v.string(),
        phone: v.string(),
        profile_url: v.string(),
        profile_image_url: v.string(),
        research_areas: v.array(v.string()),
        office: v.string(),
        description: v.string(),
      })
    ),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    departmentPrefix: v.string(),
    departmentName: v.string(),
    total: v.number(),
    autoMatched: v.number(),
    agentMatched: v.number(),
    updated: v.number(),
    skippedNoMatch: v.number(),
    skippedLowConfidence: v.number(),
    skippedNoData: v.number(),
    warnings: v.array(v.string()),
    unmatchedNames: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<DepartmentEnrichmentResult> => {
    const dryRun = args.dryRun ?? false;
    const [dbProfessors, departments]: [
      DbProfessorMatchCandidate[],
      Array<{ prefix: string; name: string }>,
    ] = await Promise.all([
      ctx.runQuery(internal.internal.listAllProfessors),
      ctx.runQuery(api.departments.list),
    ]);
    const departmentNameByPrefix = new Map(
      departments.map((department) => [department.prefix, department.name])
    );
    const { threadId } = await professorEnrichmentAgent.createThread(ctx, {
      title: `Professor enrichment ${args.departmentPrefix}`,
      summary: `Faculty directory matching for ${args.departmentName}`,
      userId: "professor-faculty-enrichment",
    });
    const { thread } = await professorEnrichmentAgent.continueThread(ctx, {
      threadId,
      userId: "professor-faculty-enrichment",
    });

    const { autoMatches, unresolved } = resolveDeterministicMatches(
      args.professors,
      dbProfessors,
      args.departmentPrefix
    );
    const dbCandidates = buildAgentCandidatePool(
      unresolved,
      dbProfessors,
      args.departmentPrefix
    );

    let agentResults: z.infer<typeof FacultyProfessorMatchSchema> = [];
    if (unresolved.length > 0) {
      agentResults = await matchFacultyProfessorsWithAgent(thread, {
        departmentPrefix: args.departmentPrefix,
        departmentName: args.departmentName,
        professors: unresolved,
        dbCandidates,
        departmentNameByPrefix,
      });
    }

    const timestamp = Date.now();
    const resolvedUpdates = resolveFacultyEnrichmentUpdates({
      autoMatches,
      unresolved,
      agentMatches: agentResults,
      allowedExternalIds: new Set(
        dbCandidates.map((professor) => professor.externalId)
      ),
      timestamp,
    });

    const updated: number =
      resolvedUpdates.updates.length > 0 && !dryRun
        ? ((await ctx.runMutation(
            internal.internal.updateProfessorFacultyEnrichment,
            {
              updates: resolvedUpdates.updates,
            }
          )) as number)
        : resolvedUpdates.updates.length;

    await posthog.shutdown();

    return {
      departmentPrefix: args.departmentPrefix,
      departmentName: args.departmentName,
      total: args.professors.length,
      autoMatched: autoMatches.length,
      agentMatched: resolvedUpdates.agentMatched,
      updated,
      skippedNoMatch: resolvedUpdates.skippedNoMatch,
      skippedLowConfidence: resolvedUpdates.skippedLowConfidence,
      skippedNoData: resolvedUpdates.skippedNoData,
      warnings: args.warnings,
      unmatchedNames: resolvedUpdates.unmatchedNames,
    };
  },
});
