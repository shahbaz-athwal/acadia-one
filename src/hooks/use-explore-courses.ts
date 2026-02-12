import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import { buildConvexFilters } from "@/routes/explore";
import { api } from "../../convex/_generated/api";

const routeApi = getRouteApi("/explore");

const PAGE_SIZE = 10;

export { PAGE_SIZE };

export function useExploreCourses(initialPageSize = PAGE_SIZE) {
  const search = routeApi.useSearch();
  const convexFilters = buildConvexFilters(search);

  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.courses.listForExplore,
    { filters: convexFilters },
    { initialNumItems: initialPageSize }
  );

  const { data: totalCount } = useSuspenseQuery(
    convexQuery(api.courses.countForExplore, { filters: convexFilters })
  );

  return {
    courses: results,
    totalCount,
    status,
    loadMore,
    isLoading,
  };
}
