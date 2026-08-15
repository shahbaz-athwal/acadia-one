import type { Layout } from "react-resizable-panels";
import { z } from "zod";

import {
  DEFAULT_WORKSPACE_LAYOUT,
  WORKSPACE_LAYOUT_COOKIE_NAME,
  WORKSPACE_PANEL_CONSTRAINTS,
} from "@/features/explore/layout/layout-config";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const LAYOUT_TOTAL = 100;
const LAYOUT_TOTAL_TOLERANCE = 0.01;

const workspaceLayoutSchema = z
  .object({
    courses: z
      .number()
      .min(WORKSPACE_PANEL_CONSTRAINTS.courses.minSize)
      .max(WORKSPACE_PANEL_CONSTRAINTS.courses.maxSize),
    schedule: z
      .number()
      .min(WORKSPACE_PANEL_CONSTRAINTS.schedule.minSize)
      .max(WORKSPACE_PANEL_CONSTRAINTS.schedule.maxSize),
    sidebar: z
      .number()
      .min(WORKSPACE_PANEL_CONSTRAINTS.sidebar.minSize)
      .max(WORKSPACE_PANEL_CONSTRAINTS.sidebar.maxSize),
  })
  .refine(
    (layout) =>
      Math.abs(
        layout.courses + layout.schedule + layout.sidebar - LAYOUT_TOTAL
      ) <= LAYOUT_TOTAL_TOLERANCE
  );

export type WorkspaceLayout = z.infer<typeof workspaceLayoutSchema>;

export function parseWorkspaceLayout(value: unknown): WorkspaceLayout {
  const result = workspaceLayoutSchema.safeParse(value);

  return result.success ? result.data : DEFAULT_WORKSPACE_LAYOUT;
}

export function parseWorkspaceLayoutCookie(
  cookieValue: string | undefined
): WorkspaceLayout {
  if (cookieValue === undefined || cookieValue === "") {
    return DEFAULT_WORKSPACE_LAYOUT;
  }

  try {
    const parsedValue: unknown = JSON.parse(cookieValue);
    return parseWorkspaceLayout(parsedValue);
  } catch {
    return DEFAULT_WORKSPACE_LAYOUT;
  }
}

export function writeWorkspaceLayoutCookie(layout: Layout) {
  const result = workspaceLayoutSchema.safeParse(layout);

  if (!result.success) {
    return;
  }

  const secureAttribute =
    window.location.protocol === "https:" ? "; Secure" : "";
  const value = encodeURIComponent(JSON.stringify(result.data));

  // oxlint-disable-next-line unicorn/no-document-cookie -- This non-sensitive preference is written client-side to avoid a server round trip after every resize.
  document.cookie = `${WORKSPACE_LAYOUT_COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureAttribute}`;
}
