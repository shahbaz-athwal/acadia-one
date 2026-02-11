import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { CourseView } from "@/components/explore/course-view";
import { FilterPanel } from "@/components/explore/filter-panel";
import { ScheduleView } from "@/components/explore/schedule-view";

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
});

export type ExploreSearchParams = z.infer<typeof exploreSearchSchema>;

export const SEARCH_DEFAULTS: ExploreSearchParams = {
  term: [],
  dept: [],
  prof: [],
  day: [],
  sv: "calendar",
  st: "",
};

export function withSearchDefaults(
  prev: Partial<ExploreSearchParams>
): ExploreSearchParams {
  return { ...SEARCH_DEFAULTS, ...prev };
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
      } as Record<string, unknown>),
    ],
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
