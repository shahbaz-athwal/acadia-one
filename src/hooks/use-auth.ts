import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { validateSessionQuery } from "@/queries/explore";
import { api } from "../../convex/_generated/api";

const SESSION_KEY = "acadia-one-session-id";
const TOKEN_KEY = "acadia-one-session-token";
const TOKEN_HASH_KEY = "acadia-one-session-token-hash";

export function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export function getStoredTokenHash(): string {
  const raw = localStorage.getItem(TOKEN_HASH_KEY);
  if (raw === null || raw === "null" || raw === "undefined") {
    return "";
  }
  try {
    return JSON.parse(raw) as string;
  } catch {
    return raw;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const sessionId = getOrCreateSessionId();
  const [token, setToken] = useLocalStorage<string | null>(TOKEN_KEY, null);
  const [tokenHash, setTokenHash] = useLocalStorage<string>(TOKEN_HASH_KEY, "");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticateUser = useAction(api.auth.authenticateUser);
  const refreshUserDataAction = useAction(api.auth.refreshUserData);
  const logoutSession = useMutation(api.sessions.logoutSession);

  const { data: validation } = useSuspenseQuery(
    validateSessionQuery(sessionId, tokenHash)
  );

  const isAuthenticated = validation.valid === true;
  const studentId = validation.valid ? validation.studentId : null;
  const userDataStatus = validation.valid ? validation.userDataStatus : null;
  const profileFirstName = validation.valid
    ? (validation.profileFirstName ?? null)
    : null;
  const profileLastName = validation.valid
    ? (validation.profileLastName ?? null)
    : null;

  async function login(username: string, password: string) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authenticateUser({ sessionId, username, password });

      if (result.success) {
        try {
          await queryClient.ensureQueryData(
            validateSessionQuery(sessionId, result.tokenHash)
          );
        } catch {
          // Fall back to regular suspense fetch path if preloading fails.
        }
        setToken(result.token);
        setTokenHash(result.tokenHash);
        return { success: true as const };
      }

      setError(result.error);
      return { success: false as const, error: result.error };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      return { success: false as const, error: message };
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshUserData() {
    if (!token) {
      return {
        success: false as const,
        error: "You must be logged in to refresh data.",
      };
    }

    setIsRefreshingData(true);
    try {
      return await refreshUserDataAction({ sessionId, token });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false as const, error: message };
    } finally {
      setIsRefreshingData(false);
    }
  }

  async function logout() {
    let deletedServerData = tokenHash.length === 0;
    setIsLoggingOut(true);

    if (tokenHash.length > 0) {
      try {
        const result = await logoutSession({ sessionId, tokenHash });
        deletedServerData = result.success;
      } catch {
        deletedServerData = false;
      }
    }

    try {
      await queryClient.ensureQueryData(validateSessionQuery(sessionId, ""));
    } catch {
      // Fall back to regular suspense fetch path if preloading fails.
    }

    setToken(null);
    setTokenHash("");
    setError(null);
    setIsLoggingOut(false);

    return { success: deletedServerData };
  }

  return {
    sessionId,
    token,
    tokenHash,
    isAuthenticated,
    studentId,
    userDataStatus,
    profileFirstName,
    profileLastName,
    isLoading,
    isRefreshingData,
    isLoggingOut,
    error,
    login,
    refreshUserData,
    logout,
  };
}
