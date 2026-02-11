import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { ExploreSearchParams } from "@/routes/explore";
import { api } from "../../convex/_generated/api";

const routeApi = getRouteApi("/explore");

const DEFAULTS: ExploreSearchParams = {
  term: [],
  dept: [],
  prof: [],
  day: [],
};

function withDefaults(prev: Partial<ExploreSearchParams>): ExploreSearchParams {
  return { ...DEFAULTS, ...prev };
}

export function useExploreFilters() {
  const search = routeApi.useSearch();
  const navigate = useNavigate();
  const filters = {
    termCodes: search.term,
    departmentPrefixes: search.dept,
    professorExternalIds: search.prof,
    days: search.day,
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

  const setFilters = (partial: Partial<typeof filters>) => {
    navigate({
      to: "/explore",
      search: (prev) => ({
        ...withDefaults(prev),
        term: partial.termCodes ?? prev.term,
        dept: partial.departmentPrefixes ?? prev.dept,
        prof: partial.professorExternalIds ?? prev.prof,
        day: partial.days ?? prev.day,
      }),
    });
  };

  const clearFilters = () => {
    navigate({
      to: "/explore",
      search: DEFAULTS,
    });
  };

  const terms = useQuery(api.terms.list);
  const departments = useQuery(api.departments.list);
  const professors = useQuery(api.professors.list);

  return {
    filters,

    setTermCodes,
    setDepartmentPrefixes,
    setProfessorExternalIds,
    setDays,
    setFilters,
    clearFilters,

    options: {
      terms,
      departments,
      professors,
    },
  };
}
