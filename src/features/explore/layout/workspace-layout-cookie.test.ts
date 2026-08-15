import { describe, expect, test } from "bun:test";

import { DEFAULT_WORKSPACE_LAYOUT } from "@/features/explore/layout/layout-config";
import { parseWorkspaceLayoutCookie } from "@/features/explore/layout/workspace-layout-cookie";

describe("parseWorkspaceLayoutCookie", () => {
  test("returns a valid persisted layout", () => {
    const layout = {
      courses: 47,
      schedule: 28,
      sidebar: 25,
    };

    expect(parseWorkspaceLayoutCookie(JSON.stringify(layout))).toEqual(layout);
  });

  test("falls back when a panel violates its constraints", () => {
    const invalidLayout = {
      courses: 40,
      schedule: 40,
      sidebar: 40,
    };

    expect(parseWorkspaceLayoutCookie(JSON.stringify(invalidLayout))).toEqual(
      DEFAULT_WORKSPACE_LAYOUT
    );
  });

  test("falls back when the cookie is malformed", () => {
    expect(parseWorkspaceLayoutCookie("not-json")).toEqual(
      DEFAULT_WORKSPACE_LAYOUT
    );
  });
});
