import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { CourseView } from "@/components/explore/course-view";
import { FilterPanel } from "@/components/explore/filter-panel";
import { ScheduleView } from "@/components/explore/schedule-view";
import { getOrCreateSessionId } from "@/hooks/use-auth";
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
  sv: z.enum(["calendar", "agenda"]).catch("calendar"),
  st: z.string().catch(""),
  page: z.coerce.number().int().positive().catch(1),
});

export type ExploreSearchParams = z.infer<typeof exploreSearchSchema>;

export const SEARCH_DEFAULTS: ExploreSearchParams = {
  term: [],
  dept: [],
  prof: [],
  day: [],
  sv: "calendar",
  st: "",
  page: 1,
};

export function withSearchDefaults(
  prev: Partial<ExploreSearchParams>
): ExploreSearchParams {
  return { ...SEARCH_DEFAULTS, ...prev };
}

export function buildConvexFilters(
  search: Pick<ExploreSearchParams, "term" | "dept" | "prof" | "day">
) {
  const f: Record<string, string[] | number[]> = {};
  if (search.term.length > 0) {
    f.termCodes = search.term;
  }
  if (search.dept.length > 0) {
    f.departmentPrefixes = search.dept;
  }
  if (search.prof.length > 0) {
    f.professorExternalIds = search.prof;
  }
  if (search.day.length > 0) {
    f.days = search.day;
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
        sv: "calendar",
        st: "",
        page: 1,
      } as Record<string, unknown>),
    ],
  },
  loaderDeps: ({ search }) => ({
    term: search.term,
    dept: search.dept,
    prof: search.prof,
    day: search.day,
  }),
  loader: async ({ context, deps }) => {
    const sessionId = getOrCreateSessionId();
    const tokenHash = localStorage.getItem("acadia-one-session-token-hash");
    const convexFilters = buildConvexFilters(deps);

    const prefetches: Promise<unknown>[] = [
      context.queryClient.ensureQueryData(
        convexQuery(api.explore.filterOptions, {})
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.addToSchedule.get, { sessionId })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.courses.countForExplore, { filters: convexFilters })
      ),
    ];

    if (tokenHash) {
      prefetches.push(
        context.queryClient.ensureQueryData(
          convexQuery(api.sessions.validateSession, { sessionId, tokenHash })
        ),
        context.queryClient.ensureQueryData(
          convexQuery(api.sessions.getUserData, { sessionId, tokenHash })
        )
      );
    }

    await Promise.all(prefetches);
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main className="h-dvh overflow-hidden p-2">
      <section className="flex h-full min-h-0 gap-2 overflow-hidden">
        <FilterPanel className="w-[20%] min-w-0" />
        <CourseView className="w-[50%] min-w-0" />
        <ScheduleView className="w-[30%] min-w-0" />
      </section>
    </main>
  );
}
