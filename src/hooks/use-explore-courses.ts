import { usePaginatedQuery, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";

export interface ExploreFilters {
  termCodes: string[];
  departmentPrefixes: string[];
  professorExternalIds: string[];
  days: number[];
}

const EMPTY_FILTERS: ExploreFilters = {
  termCodes: [],
  departmentPrefixes: [],
  professorExternalIds: [],
  days: [],
};

const PAGE_SIZE = 10;

export function useExploreCourses(initialPageSize = PAGE_SIZE) {
  const [filters, _] = useState<ExploreFilters>(EMPTY_FILTERS);

  // Build the filters arg for Convex — only include non-empty arrays
  const convexFilters = useMemo(() => {
    const f: Record<string, string[] | number[]> = {};
    if (filters.termCodes.length > 0) {
      f.termCodes = filters.termCodes;
    }
    if (filters.departmentPrefixes.length > 0) {
      f.departmentPrefixes = filters.departmentPrefixes;
    }
    if (filters.professorExternalIds.length > 0) {
      f.professorExternalIds = filters.professorExternalIds;
    }
    if (filters.days.length > 0) {
      f.days = filters.days;
    }
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filters]);

  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.courses.listForExplore,
    { filters: convexFilters },
    { initialNumItems: initialPageSize }
  );

  const count = useQuery(api.courses.countForExplore, {
    filters: convexFilters,
  });

  return {
    courses: results,
    totalCount: count,
    status,
    loadMore,
    isLoading,
    filters,
  };
}
