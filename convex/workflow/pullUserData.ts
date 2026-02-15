"use node";

import { internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";
import { getAcadiaImpersonator } from "../acadia/impersonator";

export const pullUserData = internalAction(
  async (
    ctx: ActionCtx,
    { sessionId, token }: { sessionId: string; token: string }
  ) => {
    await ctx.runMutation(internal.internal.setAcadiaUserDataStatus, {
      sessionId,
      status: "pending",
    });

    try {
      const impersonator = await getAcadiaImpersonator(ctx, sessionId, token);
      const [programDetails, grades] = await Promise.all([
        impersonator.getStudentProgramDetails(),
        impersonator.getStudentGrades(),
      ]);

      const primaryProgramCode = programDetails.programs[0]?.programCode;
      const programEvaluation =
        await impersonator.getProgramEvaluation(primaryProgramCode);

      await ctx.runMutation(internal.internal.setAcadiaUserData, {
        sessionId,
        ...programDetails,
        grades,
        programEvaluation,
      });

      const allCombinations = programEvaluation.requirements.flatMap(
        (requirement) =>
          requirement.subrequirements.flatMap((subrequirement) =>
            subrequirement.groups.map((group) => ({
              requirementCode: requirement.code,
              subrequirementId: subrequirement.id,
              groupId: group.id,
              groupCourseCodes: group.courses.map((course) => course.code),
              key: `${requirement.code}:${subrequirement.id}:${group.id}`,
            }))
          )
      );

      const uniqueCombinationMap = new Map(
        allCombinations.map((combination) => [combination.key, combination])
      );
      const uniqueCombinations = [...uniqueCombinationMap.values()];
      if (uniqueCombinations.length > 0) {
        const existingKeys = await ctx.runQuery(
          internal.internal.getExistingRsgKeys,
          {
            keys: uniqueCombinations.map((combination) => combination.key),
          }
        );
        const existingKeySet = new Set(existingKeys);
        const missingCombinations = uniqueCombinations.filter(
          (combination) => !existingKeySet.has(combination.key)
        );

        if (missingCombinations.length > 0) {
          const exactEntries = missingCombinations
            .filter((combination) => combination.groupCourseCodes.length > 0)
            .map((combination) => ({
              key: combination.key,
              courseCodes: combination.groupCourseCodes,
              type: "exact" as const,
            }));

          const searchCombinations = missingCombinations.filter(
            (combination) => combination.groupCourseCodes.length === 0
          );

          const searchEntries = await Promise.all(
            searchCombinations.map(async (combination) => {
              const courses = await impersonator.getRequiredCourses(
                combination.groupId,
                combination.requirementCode,
                combination.subrequirementId
              );

              return {
                key: combination.key,
                courseCodes: courses.map((course) => course.code),
                type: "search" as const,
              };
            })
          );

          const entries = [...exactEntries, ...searchEntries];
          await ctx.runMutation(internal.internal.upsertRsgEntries, {
            entries,
          });
        }
      }
    } catch (error) {
      console.error("Error pulling user data", error);
      await ctx.runMutation(internal.internal.setAcadiaUserDataStatus, {
        sessionId,
        status: "error",
        error: JSON.stringify(error),
      });
    }
  }
);
