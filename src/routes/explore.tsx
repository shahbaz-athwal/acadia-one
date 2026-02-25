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
import { SchedulePreviewProvider } from "@/hooks/use-schedule-preview";
import {
  TIME_RANGE_MAX_MINUTES,
  TIME_RANGE_MINUTES,
} from "@/lib/explore-filter-constants";
import {
  buildConvexFilters,
  coursesQuery,
  filterOptionsQuery,
  scheduleQuery,
  userDataQuery,
  validateSessionQuery,
} from "@/queries/explore";

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
  lvl: z.preprocess(parseNumberArray, z.array(z.number().int())).catch([]),
  rsg: z.preprocess(parseStringArray, z.array(z.string())).catch([]),
  ts: z.coerce
    .number()
    .int()
    .min(TIME_RANGE_MINUTES)
    .max(TIME_RANGE_MAX_MINUTES)
    .catch(TIME_RANGE_MINUTES),
  te: z.coerce
    .number()
    .int()
    .min(TIME_RANGE_MINUTES)
    .max(TIME_RANGE_MAX_MINUTES)
    .catch(TIME_RANGE_MAX_MINUTES),
  ft: z.enum(["filters", "progress"]).catch("filters"),
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
  lvl: [],
  rsg: [],
  ts: TIME_RANGE_MINUTES,
  te: TIME_RANGE_MAX_MINUTES,
  ft: "filters",
  st: "",
  q: "",
  page: 1,
};

export function withSearchDefaults(
  prev: Partial<ExploreSearchParams>
): ExploreSearchParams {
  return { ...SEARCH_DEFAULTS, ...prev };
}

export const Route = createFileRoute("/explore")({
  validateSearch: zodValidator(exploreSearchSchema),
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS)],
  },
  loaderDeps: ({ search }) => ({
    term: search.term,
    dept: search.dept,
    prof: search.prof,
    day: search.day,
    lvl: search.lvl,
    rsg: search.rsg,
    ts: search.ts,
    te: search.te,
    ft: search.ft,
    q: search.q,
    page: search.page,
  }),
  loader: async ({ context, deps }) => {
    const sessionId = getOrCreateSessionId();
    const tokenHash = getStoredTokenHash() ?? "";
    const filters = buildConvexFilters(deps);

    await Promise.all([
      context.queryClient.ensureQueryData(filterOptionsQuery()),
      context.queryClient.ensureQueryData(scheduleQuery(sessionId)),
      context.queryClient.ensureQueryData(
        coursesQuery({
          page: deps.page,
          filters,
          searchQuery: deps.q,
        })
      ),
      context.queryClient.ensureQueryData(
        validateSessionQuery(sessionId, tokenHash)
      ),
      context.queryClient.ensureQueryData(userDataQuery(sessionId, tokenHash)),
    ]);
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
    <SchedulePreviewProvider>
      <main className="h-dvh overflow-hidden overscroll-none overscroll-y-none">
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
    </SchedulePreviewProvider>
  );
}
