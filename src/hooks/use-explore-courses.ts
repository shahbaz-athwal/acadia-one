import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { buildConvexFilters, coursesQuery } from "@/queries/explore";

const routeApi = getRouteApi("/explore");

export function useExploreCourses() {
  const search = routeApi.useSearch({
    select: (state) => ({
      page: state.page,
      q: state.q,
      term: state.term,
      dept: state.dept,
      prof: state.prof,
      day: state.day,
      lvl: state.lvl,
      rsg: state.rsg,
      ts: state.ts,
      te: state.te,
    }),
  });

  const { data } = useSuspenseQuery(
    coursesQuery({
      page: search.page,
      filters: buildConvexFilters(search),
      searchQuery: search.q,
    })
  );

  return {
    courses: data.page,
    totalCount: data.totalCount,
  };
}
