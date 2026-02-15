import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import {
  SEARCH_DEFAULTS as DEFAULTS,
  withSearchDefaults as withDefaults,
} from "@/routes/explore";
import { api } from "../../convex/_generated/api";

const routeApi = getRouteApi("/explore");

export function useExploreFilters() {
  const search = routeApi.useSearch({
    select: (state) => ({
      term: state.term,
      dept: state.dept,
      prof: state.prof,
      day: state.day,
      rsg: state.rsg,
    }),
  });
  const navigate = useNavigate();
  const filters = {
    termCodes: search.term,
    departmentPrefixes: search.dept,
    professorExternalIds: search.prof,
    days: search.day,
    rsgKeys: search.rsg,
  };

  const setTermCodes = (termCodes: string[]) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), term: termCodes }),
    });
  };

  const setDepartmentPrefixes = (departmentPrefixes: string[]) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), dept: departmentPrefixes }),
    });
  };

  const setProfessorExternalIds = (professorExternalIds: string[]) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), prof: professorExternalIds }),
    });
  };

  const setDays = (days: number[]) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), day: days }),
    });
  };

  const setRsgKeys = (rsgKeys: string[]) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), rsg: rsgKeys }),
    });
  };

  const setFilters = (partial: Partial<typeof filters>) => {
    navigate({
      to: "/explore",
      search: (prev) => ({
        ...withDefaults(prev),
        term: partial.termCodes ?? prev.term,
        dept: partial.departmentPrefixes ?? prev.dept,
        prof: partial.professorExternalIds ?? prev.prof,
        day: partial.days ?? prev.day,
        rsg: partial.rsgKeys ?? prev.rsg,
      }),
    });
  };

  const clearFilters = () => {
    navigate({
      to: "/explore",
      search: DEFAULTS,
    });
  };

  const { data: options } = useSuspenseQuery(
    convexQuery(api.explore.filterOptions, {}),
  );

  return {
    filters,

    setTermCodes,
    setDepartmentPrefixes,
    setProfessorExternalIds,
    setDays,
    setRsgKeys,
    setFilters,
    clearFilters,

    options,
  };
}
