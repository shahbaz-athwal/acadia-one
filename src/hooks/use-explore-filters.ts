import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { filterOptionsQuery } from "@/queries/explore";
import {
  SEARCH_DEFAULTS as DEFAULTS,
  withSearchDefaults as withDefaults,
} from "@/routes/explore";

const routeApi = getRouteApi("/explore");
export type FilterPanelTab = "filters" | "progress";

export function useExploreFilters() {
  const search = routeApi.useSearch({
    select: (state) => ({
      term: state.term,
      dept: state.dept,
      prof: state.prof,
      day: state.day,
      rsg: state.rsg,
      ft: state.ft,
      q: state.q,
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
  const panelTab = search.ft;
  const searchQuery = search.q;

  const setSearchQuery = (q: string) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), q, page: 1 }),
    });
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

  const setPanelTab = (tab: FilterPanelTab) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), ft: tab }),
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

  const { data: options } = useSuspenseQuery(filterOptionsQuery());

  return {
    filters,
    panelTab,
    searchQuery,

    setSearchQuery,
    setTermCodes,
    setDepartmentPrefixes,
    setProfessorExternalIds,
    setDays,
    setRsgKeys,
    setPanelTab,
    setFilters,
    clearFilters,

    options,
  };
}
