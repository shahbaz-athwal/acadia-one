import type { Layout, PanelProps } from "react-resizable-panels";

export const WORKSPACE_PANEL_IDS = {
  courses: "courses",
  schedule: "schedule",
  sidebar: "sidebar",
} as const;

export const WORKSPACE_LAYOUT_ID = "explore-workspace";
export const WORKSPACE_LAYOUT_COOKIE_NAME = "acadia-explore-layout";

export const WORKSPACE_PANEL_CONSTRAINTS = {
  courses: {
    defaultSize: 50,
    maxSize: 65,
    minSize: 30,
  },
  schedule: {
    defaultSize: 30,
    maxSize: 45,
    minSize: 20,
  },
  sidebar: {
    defaultSize: 20,
    maxSize: 30,
    minSize: 15,
  },
} as const;

export const DEFAULT_WORKSPACE_LAYOUT = {
  courses: WORKSPACE_PANEL_CONSTRAINTS.courses.defaultSize,
  schedule: WORKSPACE_PANEL_CONSTRAINTS.schedule.defaultSize,
  sidebar: WORKSPACE_PANEL_CONSTRAINTS.sidebar.defaultSize,
} satisfies Layout;

type PanelSizeConfig = Pick<PanelProps, "defaultSize" | "maxSize" | "minSize">;

export const WORKSPACE_PANEL_SIZES = {
  courses: {
    defaultSize: `${WORKSPACE_PANEL_CONSTRAINTS.courses.defaultSize}%`,
    maxSize: `${WORKSPACE_PANEL_CONSTRAINTS.courses.maxSize}%`,
    minSize: `${WORKSPACE_PANEL_CONSTRAINTS.courses.minSize}%`,
  },
  schedule: {
    defaultSize: `${WORKSPACE_PANEL_CONSTRAINTS.schedule.defaultSize}%`,
    maxSize: `${WORKSPACE_PANEL_CONSTRAINTS.schedule.maxSize}%`,
    minSize: `${WORKSPACE_PANEL_CONSTRAINTS.schedule.minSize}%`,
  },
  sidebar: {
    defaultSize: `${WORKSPACE_PANEL_CONSTRAINTS.sidebar.defaultSize}%`,
    maxSize: `${WORKSPACE_PANEL_CONSTRAINTS.sidebar.maxSize}%`,
    minSize: `${WORKSPACE_PANEL_CONSTRAINTS.sidebar.minSize}%`,
  },
} satisfies Record<keyof typeof WORKSPACE_PANEL_IDS, PanelSizeConfig>;

export const RESIZE_HANDLE_CLASS_NAME =
  "before:pointer-events-none before:absolute before:top-1/2 before:left-1/2 before:z-10 before:h-6 before:w-1 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-muted-foreground/25 before:transition-all before:duration-300 before:ease-[cubic-bezier(0.32,0.72,0,1)] hover:before:h-10 hover:before:bg-muted-foreground/40 active:before:h-12 active:before:w-1.5 active:before:bg-primary";
