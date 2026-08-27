import { createHmac, timingSafeEqual } from "node:crypto";

import {
  deleteCookie,
  getCookie,
  getRequestIP,
  setCookie,
} from "@tanstack/react-start/server";

const SESSION_COOKIE_NAME = "acadia_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const MILLISECONDS_PER_SECOND = 1000;
const TOKEN_PART_COUNT = 2;

export class AdminAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export function isAdminPasswordConfigured() {
  const password = process.env.ADMIN_PASSWORD;

  return typeof password === "string" && password.length > 0;
}

function readAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;

  if (typeof password !== "string" || password.length === 0) {
    throw new AdminAuthError(
      "ADMIN_PASSWORD is not set, so the admin dashboard is disabled."
    );
  }

  return password;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeEquals(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf-8");
  const rightBytes = Buffer.from(right, "utf-8");

  if (leftBytes.length !== rightBytes.length) {
    // `timingSafeEqual` throws on length mismatch, and the length of a secret
    // is not itself sensitive here.
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
}

export function verifyAdminPassword(candidate: string) {
  return constantTimeEquals(candidate, readAdminPassword());
}

function createSessionToken(expiresAt: number, secret: string) {
  return `${expiresAt}.${sign(String(expiresAt), secret)}`;
}

function isValidSessionToken(token: string, secret: string, now: number) {
  const parts = token.split(".");

  if (parts.length !== TOKEN_PART_COUNT) {
    return false;
  }

  const [expiresAtValue, signature] = parts;

  if (expiresAtValue === undefined || signature === undefined) {
    return false;
  }

  if (!constantTimeEquals(signature, sign(expiresAtValue, secret))) {
    return false;
  }

  const expiresAt = Number.parseInt(expiresAtValue, 10);

  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function startAdminSession() {
  const secret = readAdminPassword();
  const expiresAt =
    Date.now() + SESSION_MAX_AGE_SECONDS * MILLISECONDS_PER_SECOND;

  setCookie(SESSION_COOKIE_NAME, createSessionToken(expiresAt, secret), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function endAdminSession() {
  deleteCookie(SESSION_COOKIE_NAME, { path: "/" });
}

/**
 * Reads and verifies the signed session cookie. The signature is keyed on
 * `ADMIN_PASSWORD`, so rotating the password invalidates every outstanding
 * session for free.
 */
export function hasAdminSession() {
  if (!isAdminPasswordConfigured()) {
    return false;
  }

  const token = getCookie(SESSION_COOKIE_NAME);

  if (token === undefined || token === "") {
    return false;
  }

  return isValidSessionToken(token, readAdminPassword(), Date.now());
}

export function currentActorIp() {
  return getRequestIP({ xForwardedFor: true }) ?? null;
}

const SIGN_IN_WINDOW_MS = 5 * 60 * MILLISECONDS_PER_SECOND * 60;
const MAX_SIGN_IN_ATTEMPTS = 10;
const failedSignIns = new Map<string, { count: number; windowStart: number }>();

/**
 * A single shared secret with no account lockout is trivially brute-forceable,
 * so failed attempts are throttled per client address. In-memory only: this is
 * a speed bump for a single-process deployment, not a distributed rate limiter.
 */
export function assertSignInAllowed(now: number = Date.now()) {
  const key = currentActorIp() ?? "unknown";
  const entry = failedSignIns.get(key);

  if (entry === undefined || now - entry.windowStart > SIGN_IN_WINDOW_MS) {
    return;
  }

  if (entry.count >= MAX_SIGN_IN_ATTEMPTS) {
    throw new AdminAuthError(
      "Too many failed sign-in attempts. Try again later."
    );
  }
}

export function recordFailedSignIn(now: number = Date.now()) {
  const key = currentActorIp() ?? "unknown";
  const entry = failedSignIns.get(key);

  if (entry === undefined || now - entry.windowStart > SIGN_IN_WINDOW_MS) {
    failedSignIns.set(key, { count: 1, windowStart: now });
    return;
  }

  entry.count += 1;
}

export function clearFailedSignIns() {
  failedSignIns.delete(currentActorIp() ?? "unknown");
}
