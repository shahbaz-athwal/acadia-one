"use client";

import { useQuery } from "convex/react";
import { Compass } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ExploreFilters } from "@/features/explore/components/explore-filters";
import { ExploreToolbar } from "@/features/explore/components/explore-toolbar";
import { useExploreQueryState } from "@/features/explore/query-state";
import { formatMinutes24 } from "@/features/explore/time";
import { api } from "../../../convex/_generated/api";

export default function ExplorePage() {
  const { state } = useExploreQueryState();
  const { filters, search, sort } = state;
  const timeRange = filters.time
    ? {
        start: formatMinutes24(filters.time.start),
        end: formatMinutes24(filters.time.end),
      }
    : undefined;

  const queryFilters: {
    search?: string;
    professorIds?: string[];
    termCodes?: string[];
    timeRange?: { start: string; end: string };
    departmentPrefixes?: string[];
    academicLevels?: number[];
  } = {};

  if (search) queryFilters.search = search;
  if (filters.professorIds.length)
    queryFilters.professorIds = filters.professorIds;
  if (filters.term.length) queryFilters.termCodes = filters.term;
  if (timeRange) queryFilters.timeRange = timeRange;
  if (filters.subjectIds.length)
    queryFilters.departmentPrefixes = filters.subjectIds;
  if (filters.academicLevels.length)
    queryFilters.academicLevels = filters.academicLevels;

  const coursesResult = useQuery(api.courses.list, {
    filters: Object.keys(queryFilters).length > 0 ? queryFilters : undefined,
    sort,
    pagination: { limit: 20 },
  });

  const courses = coursesResult?.courses ?? [];

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6">
      <div className="grid flex-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-[calc(100vh-8rem)] rounded-lg border bg-background">
          <ExploreFilters />
        </aside>
        <section className="flex min-h-[60vh] flex-col gap-4">
          <ExploreToolbar />
          <div className="flex flex-1">
            {coursesResult === undefined ? (
              <Empty className="flex-1">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Compass className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>Loading results</EmptyTitle>
                  <EmptyDescription>
                    Fetching courses from Convex.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : courses.length === 0 ? (
              <Empty className="flex-1">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Compass className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>No results</EmptyTitle>
                  <EmptyDescription>
                    Adjust filters or search to find courses.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  Try removing filters or changing the time range.
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <div
                    className="flex flex-col gap-2 rounded-lg border bg-background p-4"
                    key={course.id}
                  >
                    <div className="text-muted-foreground text-sm">
                      {course.code} • {course.departmentPrefix}
                    </div>
                    <div className="font-semibold text-base">
                      {course.title}
                    </div>
                    <div className="line-clamp-3 text-muted-foreground text-sm">
                      {course.description || "No description available."}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 text-muted-foreground text-xs">
                      <span>Credits: {course.credits}</span>
                      <span>Ratings: {course._computed.ratingCount}</span>
                      <span>
                        Difficulty:{" "}
                        {course._computed.avgDifficulty?.toFixed(1) ?? "N/A"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
