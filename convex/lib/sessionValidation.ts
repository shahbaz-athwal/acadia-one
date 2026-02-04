/**
 * Acadia session timeout in milliseconds (10 minutes)
 * Acadia sessions expire after 10 minutes of inactivity
 */
export const ACADIA_SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Checks if an Acadia session has expired based on the last authentication timestamp.
 *
 * @param lastAcadiaAuth - The timestamp (in milliseconds) of the last Acadia authentication
 * @returns true if the session has expired (more than 10 minutes old), false otherwise
 */
export function isAcadiaSessionExpired(lastAcadiaAuth: number): boolean {
  return Date.now() - lastAcadiaAuth > ACADIA_SESSION_TIMEOUT_MS;
}
