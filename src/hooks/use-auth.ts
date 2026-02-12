import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
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

export function useAuth() {
  const sessionId = getOrCreateSessionId();
  const [token, setToken] = useLocalStorage<string | null>(TOKEN_KEY, null);
  const [tokenHash, setTokenHash] = useLocalStorage<string | null>(
    TOKEN_HASH_KEY,
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticateUser = useAction(api.auth.authenticateUser);

  const { data: validation } = useSuspenseQuery(
    convexQuery(
      api.sessions.validateSession,
      tokenHash ? { sessionId, tokenHash } : "skip"
    )
  );

  useEffect(() => {
    if (!validation.valid && token) {
      setToken(null);
      setTokenHash(null);
    }
  }, [validation, token, setToken, setTokenHash]);

  const isAuthenticated = validation?.valid === true;

  async function login(username: string, password: string) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authenticateUser({ sessionId, username, password });

      if (result.success) {
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

  function logout() {
    setToken(null);
    setTokenHash(null);
    setError(null);
  }

  return {
    sessionId,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
  };
}
