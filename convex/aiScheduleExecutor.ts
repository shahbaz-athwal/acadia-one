"use node";

import { generateText, Output, stepCountIs, tool } from "ai";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { api, internal } from "./_generated/api";
import { type ActionCtx, action } from "./_generated/server";
import { geminiModel as model } from "./lib/aiModel";
import {
  getTreatInProgressAsSatisfiedFlag,
  normalizePlannerOptions,
} from "./lib/aiSchedule/config";
import { buildPlanningPrompt } from "./lib/aiSchedule/prompt";
import {
  buildNoSaveResult,
  buildPlannerSummary,
  resolveRequirementOutcomes,
} from "./lib/aiSchedule/result";
import {
  buildPlanningSnapshot,
  buildRequirementKey,
  collectCandidateCourseCodes,
  dedupeWarnings,
  normalizeCourseCodes,
} from "./lib/aiSchedule/snapshot";
import {
  type PlannerExecutionResult,
  PlannerModelOutputSchema,
  type TermDescriptor,
  type TermScheduleSection,
} from "./lib/aiSchedule/types";
import { posthog } from "./lib/posthog";

const SearchCoursesToolInputSchema = z.object({
  courseCodes: z.array(z.string().trim().min(1)).min(1),
  filters: z
    .object({
      timeRange: z
        .object({
          start: z.string().trim().min(1),
          end: z.string().trim().min(1),
        })
        .optional(),
      daysOfWeek: z.array(z.string().trim().min(1)).optional(),
      academicLevels: z.array(z.number().int()).optional(),
    })
    .optional(),
});

const DetectConflictsToolInputSchema = z.object({
  candidateSectionIds: z.array(z.string().trim().min(1)).min(1),
  includeSavedSchedule: z.boolean().optional(),
});

const SaveScheduleToolInputSchema = z.object({
  sectionIds: z.array(z.string().trim().min(1)).min(1),
  mode: z.enum(["append", "replaceTerm"]).optional(),
});

function normalizeUniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function mapScheduleItemToSection(item: {
  color: string;
  course: { code: string; title: string };
  section: {
    id: string;
    termCode: string;
    sectionCode: string;
    classStartTime: string;
    classEndTime: string;
    days: number[];
    professorName: string;
  };
}): TermScheduleSection {
  const dayNames = item.section.days.map((day) => {
    switch (day) {
      case 1:
        return "Monday";
      case 2:
        return "Tuesday";
      case 3:
        return "Wednesday";
      case 4:
        return "Thursday";
      case 5:
        return "Friday";
      case 6:
        return "Saturday";
      case 7:
        return "Sunday";
      default:
        return `Day ${day}`;
    }
  });

  return {
    sectionId: item.section.id,
    courseCode: item.course.code,
    courseTitle: item.course.title,
    sectionCode: item.section.sectionCode,
    termCode: item.section.termCode,
    classStartTime: item.section.classStartTime,
    classEndTime: item.section.classEndTime,
    daysOfWeek: dayNames,
    professorName: item.section.professorName,
    color: item.color,
  };
}

async function restoreOriginalTermSchedule(args: {
  ctx: ActionCtx;
  sessionId: string;
  termCode: string;
  originalSectionIds: string[];
}) {
  await args.ctx.runMutation(api.aiScheduleTools.saveAiScheduleSections, {
    sessionId: args.sessionId,
    termCode: args.termCode,
    sectionIds: args.originalSectionIds,
    mode: "replaceTerm",
  });
}

export const planScheduleForTerm = action({
  args: {
    sessionId: v.string(),
    tokenHash: v.string(),
    termCode: v.string(),
    instructions: v.optional(v.string()),
    plannerOptions: v.optional(
      v.object({
        treatInProgressAsSatisfied: v.optional(v.boolean()),
        targetCourseCount: v.optional(v.number()),
      })
    ),
  },
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This action coordinates validation, snapshot building, model tool use, and schedule persistence.
  handler: async (ctx, args): Promise<PlannerExecutionResult> => {
    let didPersistReplacement = false;
    let originalTermSectionIds: string[] = [];

    try {
      const plannerOptions = normalizePlannerOptions(args.plannerOptions);
      const treatInProgressAsSatisfied = getTreatInProgressAsSatisfiedFlag();
      const [validation, userData, terms, allScheduleItems] = await Promise.all(
        [
          ctx.runQuery(api.sessions.validateSession, {
            sessionId: args.sessionId,
            tokenHash: args.tokenHash,
          }),
          ctx.runQuery(api.sessions.getUserData, {
            sessionId: args.sessionId,
            tokenHash: args.tokenHash,
          }),
          ctx.runQuery(api.terms.list, {}),
          ctx.runQuery(api.schedule.get, { sessionId: args.sessionId }),
        ]
      );

      if (!validation.valid) {
        throw new ConvexError("Invalid session or token hash.");
      }

      const term = terms.find((entry) => entry.code === args.termCode);
      if (!term) {
        throw new ConvexError(`Unknown termCode '${args.termCode}'.`);
      }

      const selectedTerm: TermDescriptor = {
        code: term.code,
        name: term.name,
      };

      if (validation.userDataStatus !== "ready" || !userData) {
        return buildNoSaveResult({
          termCode: args.termCode,
          term: selectedTerm,
          studentMessage:
            "Your Acadia data is not ready yet. Refresh your data and try planning again.",
          warnings: [`User data status is '${validation.userDataStatus}'.`],
        });
      }

      if (!userData.programEvaluation) {
        return buildNoSaveResult({
          termCode: args.termCode,
          term: selectedTerm,
          studentMessage:
            "I could not access your program evaluation, so I could not build a requirements-based plan.",
          warnings: ["Program evaluation is missing."],
        });
      }

      const requirementKeys = normalizeUniqueStrings(
        userData.programEvaluation.requirements.flatMap((requirement) =>
          requirement.subrequirements.flatMap((subrequirement) =>
            subrequirement.groups.map((group) =>
              buildRequirementKey(requirement.code, subrequirement.id, group.id)
            )
          )
        )
      );
      const rsgEntries = await ctx.runQuery(
        internal.internal.getRsgEntriesByKeys,
        {
          keys: requirementKeys,
        }
      );
      const rsgByKey = new Map(
        rsgEntries.map(
          (entry) =>
            [
              entry.key,
              {
                courseCodes: normalizeCourseCodes(entry.courseCodes),
                type: entry.type,
              },
            ] as const
        )
      );

      const candidateCourseCodes = collectCandidateCourseCodes({
        programEvaluation: userData.programEvaluation,
        rsgByKey,
      });
      const completedCourseCodes = Object.entries(
        userData.coursePlanningStatuses ?? {}
      )
        .filter(([, status]) => status === "completed")
        .map(([courseCode]) => courseCode);
      const inProgressCourseCodes = Object.entries(
        userData.coursePlanningStatuses ?? {}
      )
        .filter(([, status]) => status === "inProgress")
        .map(([courseCode]) => courseCode);
      const [offeredCourseSearch, courseTitleEntries] = await Promise.all([
        candidateCourseCodes.length > 0
          ? ctx.runQuery(api.aiScheduleTools.searchCoursesForAi, {
              termCode: args.termCode,
              courseCodes: candidateCourseCodes,
            })
          : Promise.resolve({
              missingCourseCodes: [],
              results: [],
              summary: "",
            }),
        ctx.runQuery(api.aiScheduleTools.getCourseTitlesByCodes, {
          courseCodes: normalizeCourseCodes([
            ...candidateCourseCodes,
            ...completedCourseCodes,
            ...inProgressCourseCodes,
          ]),
        }),
      ]);
      const offeredCourseCodeSet = new Set(
        offeredCourseSearch.results.map((result) => result.courseCode)
      );
      const courseTitleByCode = new Map(
        courseTitleEntries.map((entry) => [entry.courseCode, entry.courseTitle])
      );

      const currentTermSchedule = allScheduleItems
        .filter((item) => item.section.termCode === args.termCode)
        .map(mapScheduleItemToSection);
      originalTermSectionIds = currentTermSchedule.map(
        (section) => section.sectionId
      );

      const snapshot = buildPlanningSnapshot({
        courseStatuses: userData.coursePlanningStatuses,
        courseTitleByCode,
        currentTermSchedule,
        offeredCourseCodeSet,
        programEvaluation: userData.programEvaluation,
        rsgByKey,
        treatInProgressAsSatisfied,
      });

      if (snapshot.unmetRequirementGroups.length === 0) {
        return buildNoSaveResult({
          termCode: args.termCode,
          term: selectedTerm,
          studentMessage:
            "I could not find any unmet requirement groups to plan for this term.",
          warnings: snapshot.warnings,
        });
      }

      const unresolvedRequirementKeys = snapshot.unmetRequirementGroups.map(
        (group) => group.requirementKey
      );
      const hasAnyTermOfferings = snapshot.unmetRequirementGroups.some(
        (group) => group.offeredCourses.length > 0
      );
      if (!hasAnyTermOfferings) {
        return buildNoSaveResult({
          termCode: args.termCode,
          term: selectedTerm,
          studentMessage:
            "I found unmet requirements, but none of their candidate courses appear to have offerings in the selected term.",
          warnings: dedupeWarnings([
            ...snapshot.warnings,
            `No remaining requirement candidates have offerings in ${selectedTerm.name} (${selectedTerm.code}).`,
          ]),
          unresolvedRequirementKeys,
        });
      }

      const { system, prompt } = buildPlanningPrompt({
        programTitle: userData.programEvaluation.title,
        programCode: userData.programEvaluation.code,
        term: selectedTerm,
        instructions: args.instructions,
        plannerOptions,
        snapshot,
      });

      const searchedCourseCodes = new Set<string>();
      let conflictChecks = 0;
      let lastConflictFreeSectionIds: string[] | null = null;
      let lastSavedSectionIds: string[] | null = null;

      const { output: modelOutput } = await generateText({
        model,
        system,
        prompt,
        temperature: 0.2,
        stopWhen: stepCountIs(12),
        output: Output.object({
          schema: PlannerModelOutputSchema,
        }),
        tools: {
          search_courses: tool({
            description:
              "Search sections for specific course codes in the selected term.",
            inputSchema: SearchCoursesToolInputSchema,
            execute: async (input) => {
              const courseCodes = normalizeCourseCodes(input.courseCodes);
              for (const courseCode of courseCodes) {
                searchedCourseCodes.add(courseCode);
              }

              return await ctx.runQuery(
                api.aiScheduleTools.searchCoursesForAi,
                {
                  termCode: args.termCode,
                  courseCodes,
                  filters: input.filters,
                }
              );
            },
          }),
          detect_conflicts: tool({
            description:
              "Check candidate sections for time conflicts within the selected term.",
            inputSchema: DetectConflictsToolInputSchema,
            execute: async (input) => {
              const candidateSectionIds = normalizeUniqueStrings(
                input.candidateSectionIds
              );
              conflictChecks += 1;

              const response = await ctx.runQuery(
                api.aiScheduleTools.detectScheduleConflictsForAi,
                {
                  termCode: args.termCode,
                  candidateSectionIds,
                  sessionId: input.includeSavedSchedule
                    ? args.sessionId
                    : undefined,
                  includeSavedSchedule: input.includeSavedSchedule ?? false,
                }
              );

              lastConflictFreeSectionIds =
                !response.hasConflicts &&
                response.invalidSectionIds.length === 0
                  ? candidateSectionIds
                  : null;

              return response;
            },
          }),
          save_schedule: tool({
            description:
              "Replace the selected term schedule with the exact final section ids.",
            inputSchema: SaveScheduleToolInputSchema,
            execute: async (input) => {
              const sectionIds = normalizeUniqueStrings(input.sectionIds);
              const mode = input.mode ?? "replaceTerm";

              if (mode !== "replaceTerm") {
                throw new Error(
                  "This executor only supports save_schedule with replaceTerm."
                );
              }

              if (
                !(
                  lastConflictFreeSectionIds &&
                  sameStringSet(lastConflictFreeSectionIds, sectionIds)
                )
              ) {
                throw new Error(
                  "Run detect_conflicts on the exact final section ids and confirm there are no conflicts before saving."
                );
              }

              const response = await ctx.runMutation(
                api.aiScheduleTools.saveAiScheduleSections,
                {
                  sessionId: args.sessionId,
                  termCode: args.termCode,
                  sectionIds,
                  mode,
                }
              );

              if (response.invalidSectionIds.length > 0) {
                throw new Error(
                  `save_schedule failed because ${response.invalidSectionIds.join(", ")} could not be resolved for ${args.termCode}.`
                );
              }

              didPersistReplacement = true;
              lastSavedSectionIds = sectionIds;
              return response;
            },
          }),
        },
      });

      const finalSectionIds = normalizeUniqueStrings(
        modelOutput.selectedSections.map((section) => section.sectionId)
      );
      const aiSuggestionSummaries = modelOutput.selectedSections.map(
        (section) => ({
          sectionId: section.sectionId,
          summary: section.summary,
        })
      );
      const finalSelectedCourseCodes = new Set(
        normalizeCourseCodes(
          modelOutput.selectedSections.map((section) => section.courseCode)
        )
      );
      const resolvedOutcomes = resolveRequirementOutcomes(
        snapshot.unmetRequirementGroups,
        finalSelectedCourseCodes
      );
      const toolTrace = {
        searchedCourseCodes: normalizeCourseCodes([...searchedCourseCodes]),
        conflictChecks,
        saveMode: "replaceTerm" as const,
      };

      if (
        didPersistReplacement &&
        !(
          lastSavedSectionIds &&
          sameStringSet(lastSavedSectionIds, finalSectionIds)
        )
      ) {
        await restoreOriginalTermSchedule({
          ctx,
          sessionId: args.sessionId,
          termCode: args.termCode,
          originalSectionIds: originalTermSectionIds,
        });
        didPersistReplacement = false;
        throw new ConvexError(
          "Planner output did not match the sections that were saved."
        );
      }

      if (didPersistReplacement && finalSectionIds.length > 0) {
        const saveResult = await ctx.runMutation(
          api.aiScheduleTools.saveAiScheduleSections,
          {
            sessionId: args.sessionId,
            termCode: args.termCode,
            sectionIds: finalSectionIds,
            aiSuggestionSummaries,
            mode: "replaceTerm",
          }
        );

        if (saveResult.invalidSectionIds.length > 0) {
          await restoreOriginalTermSchedule({
            ctx,
            sessionId: args.sessionId,
            termCode: args.termCode,
            originalSectionIds: originalTermSectionIds,
          });
          didPersistReplacement = false;
          throw new ConvexError(
            `The final schedule could not be saved because ${saveResult.invalidSectionIds.join(", ")} did not resolve in ${args.termCode}.`
          );
        }

        lastSavedSectionIds = finalSectionIds;
      }

      if (!didPersistReplacement && finalSectionIds.length > 0) {
        const conflictResult = await ctx.runQuery(
          api.aiScheduleTools.detectScheduleConflictsForAi,
          {
            termCode: args.termCode,
            candidateSectionIds: finalSectionIds,
            includeSavedSchedule: false,
          }
        );

        if (
          conflictResult.hasConflicts ||
          conflictResult.invalidSectionIds.length > 0
        ) {
          return buildNoSaveResult({
            termCode: args.termCode,
            term: selectedTerm,
            studentMessage: modelOutput.studentMessage,
            warnings: dedupeWarnings([
              ...snapshot.warnings,
              ...modelOutput.warnings,
              ...conflictResult.feedback,
              conflictResult.summary,
            ]),
            satisfiedRequirementKeys: resolvedOutcomes.satisfiedRequirementKeys,
            unresolvedRequirementKeys:
              resolvedOutcomes.unresolvedRequirementKeys,
            toolTrace,
          });
        }

        const saveResult = await ctx.runMutation(
          api.aiScheduleTools.saveAiScheduleSections,
          {
            sessionId: args.sessionId,
            termCode: args.termCode,
            sectionIds: finalSectionIds,
            aiSuggestionSummaries,
            mode: "replaceTerm",
          }
        );
        didPersistReplacement = true;

        if (saveResult.invalidSectionIds.length > 0) {
          await restoreOriginalTermSchedule({
            ctx,
            sessionId: args.sessionId,
            termCode: args.termCode,
            originalSectionIds: originalTermSectionIds,
          });
          didPersistReplacement = false;
          throw new ConvexError(
            `The final schedule could not be saved because ${saveResult.invalidSectionIds.join(", ")} did not resolve in ${args.termCode}.`
          );
        }
      }

      if (!didPersistReplacement) {
        return buildNoSaveResult({
          termCode: args.termCode,
          term: selectedTerm,
          studentMessage: modelOutput.studentMessage,
          warnings: dedupeWarnings([
            ...snapshot.warnings,
            ...modelOutput.warnings,
          ]),
          satisfiedRequirementKeys: resolvedOutcomes.satisfiedRequirementKeys,
          unresolvedRequirementKeys: resolvedOutcomes.unresolvedRequirementKeys,
          toolTrace,
        });
      }

      const savedScheduleItems = await ctx.runQuery(api.schedule.get, {
        sessionId: args.sessionId,
      });
      const selectedSections = savedScheduleItems
        .filter((item) => item.section.termCode === args.termCode)
        .map(mapScheduleItemToSection);
      const savedOutcomes = resolveRequirementOutcomes(
        snapshot.unmetRequirementGroups,
        new Set(
          normalizeCourseCodes(
            selectedSections.map((section) => section.courseCode)
          )
        )
      );
      const warnings = dedupeWarnings([
        ...snapshot.warnings,
        ...modelOutput.warnings,
      ]);

      return {
        termCode: args.termCode,
        saved: true,
        summary: buildPlannerSummary({
          term: selectedTerm,
          saved: true,
          selectedSections,
          satisfiedRequirementKeys: savedOutcomes.satisfiedRequirementKeys,
          unresolvedRequirementKeys: savedOutcomes.unresolvedRequirementKeys,
          warnings,
        }),
        studentMessage: modelOutput.studentMessage,
        selectedSections,
        satisfiedRequirementKeys: savedOutcomes.satisfiedRequirementKeys,
        unresolvedRequirementKeys: savedOutcomes.unresolvedRequirementKeys,
        warnings,
        toolTrace,
      };
    } catch (error) {
      if (didPersistReplacement) {
        try {
          await restoreOriginalTermSchedule({
            ctx,
            sessionId: args.sessionId,
            termCode: args.termCode,
            originalSectionIds: originalTermSectionIds,
          });
        } catch (restoreError) {
          console.error(
            "Failed to restore original term schedule.",
            restoreError
          );
        }
      }

      console.error("Failed to plan schedule for term.", error);
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError(
        error instanceof Error
          ? error.message
          : "Schedule planning failed unexpectedly."
      );
    } finally {
      await posthog.shutdown();
    }
  },
});
