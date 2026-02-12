import { useMemo } from "react";

const SESSION_KEY = "acadia-one-session-id";

export function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export function useSessionId(): string {
  return useMemo(() => getOrCreateSessionId(), []);
}
