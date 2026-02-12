import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { buildConvexFilters } from "@/routes/explore";
import { api } from "../../convex/_generated/api";

const routeApi = getRouteApi("/explore");

const PAGE_SIZE = 10;

export { PAGE_SIZE };

export function useExploreCourses() {
  const search = routeApi.useSearch({
    select: (state) => ({
      page: state.page,
      q: state.q,
      term: state.term,
      dept: state.dept,
      prof: state.prof,
      day: state.day,
    }),
  });
  const convexFilters = buildConvexFilters(search);

  const { data } = useSuspenseQuery(
    convexQuery(api.courses.listForExplore, {
      page: search.page,
      pageSize: PAGE_SIZE,
      filters: convexFilters,
      searchQuery: search.q || undefined,
    })
  );

  return {
    courses: data.page,
    totalCount: data.totalCount,
  };
}
