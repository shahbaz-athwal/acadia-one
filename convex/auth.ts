"use node";

import crypto from "node:crypto";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { authenticateWithAxios } from "./acadia/auth";
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

type RefreshResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

function sha256HexFromTokenHex(tokenHex: string): string {
  return crypto.createHash("sha256").update(Buffer.from(tokenHex, "hex")).digest("hex");
}

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
    },
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
      const tokenHash = crypto.createHash("sha256").update(Buffer.from(token, "hex")).digest("hex");

      // Encrypt credentials using the token as the encryption key
      const encryptedCredentials = encryptCredentials(username, password, token);

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

      await ctx.scheduler.runAfter(0, internal.workflow.pullUserData.pullUserData, {
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
  },
);

export const refreshUserData = action(
  async (
    ctx: ActionCtx,
    {
      sessionId,
      token,
    }: {
      sessionId: string;
      token: string;
    },
  ): Promise<RefreshResult> => {
    try {
      const [user, session] = await Promise.all([
        ctx.runQuery(internal.internal.getAcadiaUser, { sessionId }),
        ctx.runQuery(internal.internal.getAcadiaSession, { sessionId }),
      ]);

      if (!user || user.tokenHash !== sha256HexFromTokenHex(token)) {
        return {
          success: false,
          error: "You must be logged in to refresh data.",
        };
      }

      const now = Date.now();
      if (!session || session.expiresAt <= now) {
        return {
          success: false,
          error: "Your session has expired. Please sign in again.",
        };
      }

      await ctx.scheduler.runAfter(0, internal.workflow.pullUserData.pullUserData, {
        sessionId,
        token,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to refresh user data.", error);
      return {
        success: false,
        error: "Could not refresh data. Please try again.",
      };
    }
  },
);
