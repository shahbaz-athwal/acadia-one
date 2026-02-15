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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.internal.setAcadiaUserDataStatus, {
        sessionId,
        status: "error",
        error: message,
      });
    }
  }
);
