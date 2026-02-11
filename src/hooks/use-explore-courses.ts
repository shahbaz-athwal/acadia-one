import { getRouteApi } from "@tanstack/react-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const routeApi = getRouteApi("/explore");

const PAGE_SIZE = 10;

export function useExploreCourses(initialPageSize = PAGE_SIZE) {
  const search = routeApi.useSearch();
  const filters = {
    termCodes: search.term,
    departmentPrefixes: search.dept,
    professorExternalIds: search.prof,
    days: search.day,
  };

  // Build the filters arg for Convex — only include non-empty arrays
  const convexFilters = (() => {
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
  })();

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
  };
}
