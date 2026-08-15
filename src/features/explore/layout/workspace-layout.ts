import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { WORKSPACE_LAYOUT_COOKIE_NAME } from "@/features/explore/layout/layout-config";
import { parseWorkspaceLayoutCookie } from "@/features/explore/layout/workspace-layout-cookie";

export const getInitialWorkspaceLayout = createServerFn({
  method: "GET",
}).handler(() =>
  parseWorkspaceLayoutCookie(getCookie(WORKSPACE_LAYOUT_COOKIE_NAME))
);
