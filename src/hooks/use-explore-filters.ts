import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
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
    }),
  });
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
