"use node";

import crypto from "node:crypto";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction } from "./_generated/server";
import { authenticateWithAxios } from "./acadia/auth";
import { getAcadiaImpersonator } from "./acadia/impersonator";
import { encryptCredentials } from "./lib/encryption";

type AuthResult =
  | {
      success: true;
      token: string;
      tokenHash: string;
    }
  | {
      success: false;
      error: string;
      details?: string;
      status: number;
    };

export const authenticateUser = action(
  async (
    ctx: ActionCtx,
    {
      sessionId,
      username,
      password,
    }: {
      sessionId: string;
      username: string;
      password: string;
    }
  ): Promise<AuthResult> => {
    try {
      // Authenticate with Acadia
      let cookies: string;
      try {
        cookies = await authenticateWithAxios(username, password);
      } catch (error) {
        console.error("Authentication failed.", error);
        return {
          success: false,
          error: "Authentication failed. Please check your credentials.",
          details: error instanceof Error ? error.message : "Unknown error",
          status: 401,
        };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(Buffer.from(token, "hex"))
        .digest("hex");

      // Encrypt credentials using the token as the encryption key
      const encryptedCredentials = encryptCredentials(
        username,
        password,
        token
      );

      // Calculate expiration (7 days from now)
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const expiresAt = now + sevenDaysInMs;

      await ctx.runMutation(internal.internal.createAcadiaSessionAndUser, {
        sessionId,
        cookies,
        studentId: username,
        encryptedCredentials,
        tokenHash,
        lastAcadiaAuth: now,
        expiresAt,
      });

      await ctx.scheduler.runAfter(0, internal.auth.pullUserData, {
        sessionId,
        token,
      });

      return {
        success: true,
        token,
        tokenHash,
      };
    } catch (error) {
      return {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        status: 500,
      };
    }
  }
);

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
