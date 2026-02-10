"use node";

import crypto from "node:crypto";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction } from "./_generated/server";
import { authenticateWithAxios } from "./lib/acadia/auth";
import { getAcadiaImpersonator } from "./lib/acadia/impersonator";
import { encryptCredentials } from "./lib/encryption";

type AuthResult =
  | {
      success: true;
      sessionId: string;
      token: string;
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
      username,
      password,
    }: {
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

      // Generate session ID and token
      const sessionId = crypto.randomUUID();
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
      const lastAcadiaAuth = now;

      // Save to database with encrypted credentials
      await ctx.runMutation(internal.internal.createAcadiaSessionAndUser, {
        sessionId,
        cookies,
        studentId: username,
        encryptedCredentials,
        tokenHash,
        lastAcadiaAuth,
        expiresAt,
      });

      return {
        success: true,
        sessionId,
        token,
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
      const programDetails = await impersonator.getStudentProgramDetails();
      const grades = await impersonator.getStudentGrades();

      const primaryProgramCode = programDetails.programs[0]?.programCode;
      const programEvaluation = primaryProgramCode
        ? await impersonator.getProgramEvaluation(primaryProgramCode)
        : undefined;

      const userData = {
        pulledAt: Date.now(),
        profile: programDetails.profile,
        programs: programDetails.programs,
        grades,
        ...(programEvaluation ? { programEvaluation } : {}),
      };

      await ctx.runMutation(internal.internal.setAcadiaUserData, {
        sessionId,
        userData,
      });

      return { sessionId, status: "ready" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.internal.setAcadiaUserDataStatus, {
        sessionId,
        status: "pending",
        error: message,
      });
      return { sessionId, status: "pending" as const, error: message };
    }
  }
);
