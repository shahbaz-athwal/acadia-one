import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useDefaultLayout } from "react-resizable-panels";
import { z } from "zod";
import { CourseView } from "@/components/explore/courses/course-view";
import { FilterPanel } from "@/components/explore/filters/filter-panel";
import { ScheduleView } from "@/components/explore/schedule/schedule-view";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { getOrCreateSessionId, getStoredTokenHash } from "@/hooks/use-auth";
import { api } from "../../convex/_generated/api";

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (value == null || value === "") {
    return [];
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberArray(value: unknown): number[] {
  return parseStringArray(value)
    .map(Number)
    .filter((num) => Number.isFinite(num));
}

const exploreSearchSchema = z.object({
  term: z.preprocess(parseStringArray, z.array(z.string())).catch([]),
  dept: z.preprocess(parseStringArray, z.array(z.string())).catch([]),
  prof: z.preprocess(parseStringArray, z.array(z.string())).catch([]),
  day: z.preprocess(parseNumberArray, z.array(z.number().int())).catch([]),
  rsg: z.preprocess(parseStringArray, z.array(z.string())).catch([]),
  ft: z.enum(["filters", "progress"]).catch("filters"),
  sv: z.enum(["calendar", "agenda"]).catch("calendar"),
  st: z.string().catch(""),
  q: z.string().catch(""),
  page: z.coerce.number().int().positive().catch(1),
});

export type ExploreSearchParams = z.infer<typeof exploreSearchSchema>;

export const SEARCH_DEFAULTS: ExploreSearchParams = {
  term: [],
  dept: [],
  prof: [],
  day: [],
  rsg: [],
  ft: "filters",
  sv: "calendar",
  st: "",
  q: "",
  page: 1,
};

export function withSearchDefaults(
  prev: Partial<ExploreSearchParams>
): ExploreSearchParams {
  return { ...SEARCH_DEFAULTS, ...prev };
}

export function buildConvexFilters(
  search: Pick<ExploreSearchParams, "term" | "dept" | "prof" | "day" | "rsg">
) {
  const f: Record<string, string[] | number[]> = {};
  if (search.term.length > 0) {
    f.termCodes = [...search.term].sort();
  }
  if (search.dept.length > 0) {
    f.departmentPrefixes = [...search.dept].sort();
  }
  if (search.prof.length > 0) {
    f.professorExternalIds = [...search.prof].sort();
  }
  if (search.day.length > 0) {
    f.days = [...search.day].sort((a, b) => a - b);
  }
  if (search.rsg.length > 0) {
    f.rsgKeys = [...search.rsg].sort();
  }
  return Object.keys(f).length > 0 ? f : undefined;
}

export const Route = createFileRoute("/explore")({
  validateSearch: zodValidator(exploreSearchSchema),
  search: {
    middlewares: [
      stripSearchParams({
        term: [],
        dept: [],
        prof: [],
        day: [],
        rsg: [],
        ft: "filters",
        sv: "calendar",
        st: "",
        q: "",
        page: 1,
      } as Record<string, unknown>),
    ],
  },
  loaderDeps: ({ search }) => ({
    term: search.term,
    dept: search.dept,
    prof: search.prof,
    day: search.day,
    rsg: search.rsg,
    ft: search.ft,
    q: search.q,
    page: search.page,
  }),
  loader: async ({ context, deps }) => {
    const sessionId = getOrCreateSessionId();
    const tokenHash = getStoredTokenHash();
    const convexFilters = buildConvexFilters(deps);

    const prefetches: Promise<unknown>[] = [
      context.queryClient.ensureQueryData(
        convexQuery(api.explore.filterOptions, {})
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.schedule.get, { sessionId })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.courses.listForExplore, {
          page: deps.page,
          pageSize: 10,
          filters: convexFilters,
          searchQuery: deps.q || undefined,
        })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.sessions.validateSession, {
          sessionId,
          tokenHash: tokenHash ?? "",
        })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.sessions.getUserData, {
          sessionId,
          tokenHash: tokenHash ?? "",
        })
      ),
    ];

    await Promise.all(prefetches);
  },
  component: RouteComponent,
});

const PANEL_CONFIG = {
  filters: { defaultSize: "20%", minSize: "15%", maxSize: "30%" },
  courses: { defaultSize: "50%", minSize: "30%", maxSize: "65%" },
  schedule: { defaultSize: "30%", minSize: "20%", maxSize: "45%" },
} as const;

const pillClasses =
  "before:pointer-events-none before:absolute before:top-1/2 before:left-1/2 before:z-10 before:h-6 before:w-1 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-muted-foreground/25 before:transition-all before:duration-300 before:ease-[cubic-bezier(0.32,0.72,0,1)] hover:before:h-10 hover:before:bg-muted-foreground/40 active:before:h-12 active:before:w-1.5 active:before:bg-primary";

function RouteComponent() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "explore-layout",
    storage: localStorage,
  });
  return (
    <main className="h-dvh overflow-hidden">
      <ResizablePanelGroup
        className="m-0 h-full min-h-0 p-0"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        orientation="horizontal"
      >
        <ResizablePanel {...PANEL_CONFIG.filters}>
          <FilterPanel />
        </ResizablePanel>
        <ResizableHandle className={pillClasses} />
        <ResizablePanel {...PANEL_CONFIG.courses}>
          <CourseView />
        </ResizablePanel>
        <ResizableHandle className={pillClasses} />
        <ResizablePanel {...PANEL_CONFIG.schedule}>
          <ScheduleView />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
