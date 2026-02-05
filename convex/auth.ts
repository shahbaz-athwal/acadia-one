"use node";

import crypto from "node:crypto";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { authenticateWithAxios } from "./lib/acadia/auth";
import { encryptCredentials } from "./lib/encryption";

type AuthResult =
  | {
      success: true;
      uniqueId: string;
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
        return {
          success: false,
          error: "Authentication failed. Please check your credentials.",
          details: error instanceof Error ? error.message : "Unknown error",
          status: 401,
        };
      }

      // Generate unique ID and token
      const uniqueId = crypto.randomUUID();
      const token = crypto.randomBytes(32).toString("hex");

      // Encrypt credentials using the token as the encryption key
      const encryptedCredentials = encryptCredentials(
        username,
        password,
        token
      );

      // Calculate expiration (7 days from now)
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      const expiresAt = Date.now() + sevenDaysInMs;
      const lastAcadiaAuth = Date.now();

      // Save to database with encrypted credentials
      await ctx.runMutation(internal.internal.upsertAcadiaAuth, {
        provider: uniqueId,
        cookies,
        encryptedCredentials,
        lastAcadiaAuth,
        expiresAt,
      });

      return {
        success: true,
        uniqueId,
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
