"use node";

import crypto from "node:crypto";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { authenticateWithAxios } from "./acadia/auth";
import { encryptCredentials } from "./lib/encryption";

type AuthenticateUserResult =
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
  ): Promise<AuthenticateUserResult> => {
    const authResult = await authenticateWithAxios(username, password);
    if (!authResult.ok) {
      console.error("Authentication failed.", authResult.error);
      return {
        success: false,
        error: "Authentication failed. Please check your credentials.",
        details: authResult.error,
        status: 401,
      };
    }
    const cookies = authResult.cookies;

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(Buffer.from(token, "hex"))
      .digest("hex");

    // Encrypt credentials using the token as the encryption key
    const encryptedResult = encryptCredentials(username, password, token);
    if (!encryptedResult.ok) {
      return {
        success: false,
        error: "Failed to secure credentials",
        details: encryptedResult.error,
        status: 500,
      };
    }
    const encryptedCredentials = encryptedResult.value;

    // Calculate expiration (7 days from now)
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expiresAt = now + sevenDaysInMs;

    try {
      await ctx.runMutation(internal.internal.createAcadiaSessionAndUser, {
        sessionId,
        cookies,
        studentId: username,
        encryptedCredentials,
        tokenHash,
        lastAcadiaAuth: now,
        expiresAt,
      });

      await ctx.scheduler.runAfter(
        0,
        internal.workflow.pullUserData.pullUserData,
        {
          sessionId,
          token,
        }
      );

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
