import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import {
  TIME_RANGE_MAX_MINUTES,
  TIME_RANGE_MINUTES,
} from "@/lib/explore-filter-constants";
import { filterOptionsQuery } from "@/queries/explore";
import {
  SEARCH_DEFAULTS as DEFAULTS,
  withSearchDefaults as withDefaults,
} from "@/routes/explore";

const routeApi = getRouteApi("/explore");
export type FilterPanelTab = "filters" | "progress";

function normalizeMinute(value: number): number {
  const roundedToHalfHour = Math.round(value / 30) * 30;
  return Math.max(
    TIME_RANGE_MINUTES,
    Math.min(TIME_RANGE_MAX_MINUTES, roundedToHalfHour)
  );
}

export function useExploreFilters() {
  const search = routeApi.useSearch({
    select: (state) => ({
      term: state.term,
      dept: state.dept,
      prof: state.prof,
      day: state.day,
      lvl: state.lvl,
      rsg: state.rsg,
      cc: state.cc,
      ts: state.ts,
      te: state.te,
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
    academicLevels: search.lvl,
    timeStart: search.ts,
    timeEnd: search.te,
    rsgKeys: search.rsg,
  };
  const panelTab = search.ft;
  const searchQuery = search.q;
  const selectedCourseCode = search.cc;

  const navigateWithSearch = (
    updater: (
      prev: ReturnType<typeof withDefaults>
    ) => ReturnType<typeof withDefaults>
  ) => {
    navigate({
      to: "/explore",
      search: (prev) => updater(withDefaults(prev)),
    });
  };

  const setSearchQuery = (q: string) => {
    navigateWithSearch((prev) => ({ ...prev, q, page: 1 }));
  };

  const setTermCodes = (termCodes: string[]) => {
    navigateWithSearch((prev) => ({ ...prev, term: termCodes, page: 1 }));
  };

  const setDepartmentPrefixes = (departmentPrefixes: string[]) => {
    navigateWithSearch((prev) => ({
      ...prev,
      dept: departmentPrefixes,
      page: 1,
    }));
  };

  const setProfessorExternalIds = (professorExternalIds: string[]) => {
    navigateWithSearch((prev) => ({
      ...prev,
      prof: professorExternalIds,
      page: 1,
    }));
  };

  const setDays = (days: number[]) => {
    navigateWithSearch((prev) => ({ ...prev, day: days, page: 1 }));
  };

  const setRsgKeys = (rsgKeys: string[]) => {
    navigateWithSearch((prev) => ({
      ...prev,
      rsg: rsgKeys.filter(Boolean).slice(0, 1),
      cc: "",
      page: 1,
    }));
  };

  const setAcademicLevels = (academicLevels: number[]) => {
    navigateWithSearch((prev) => ({ ...prev, lvl: academicLevels, page: 1 }));
  };

  const setSelectedCourseCode = (courseCode: string) => {
    navigateWithSearch((prev) => ({
      ...prev,
      cc: courseCode.trim().toUpperCase(),
      rsg: [],
      page: 1,
    }));
  };

  const setTimeRange = (timeRange: [number, number]) => {
    const [rawStart, rawEnd] = timeRange;
    const start = normalizeMinute(rawStart);
    const end = normalizeMinute(rawEnd);
    navigateWithSearch((prev) => ({
      ...prev,
      page: 1,
      ts: Math.min(start, end),
      te: Math.max(start, end),
    }));
  };

  const setPanelTab = (tab: FilterPanelTab) => {
    navigateWithSearch((prev) => ({ ...prev, ft: tab }));
  };

  const setFilters = (partial: Partial<typeof filters>) => {
    navigateWithSearch((prev) => ({
      ...prev,
      page: 1,
      term: partial.termCodes ?? prev.term,
      dept: partial.departmentPrefixes ?? prev.dept,
      prof: partial.professorExternalIds ?? prev.prof,
      day: partial.days ?? prev.day,
      lvl: partial.academicLevels ?? prev.lvl,
      ts: partial.timeStart ?? prev.ts,
      te: partial.timeEnd ?? prev.te,
      rsg: partial.rsgKeys ?? prev.rsg,
    }));
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
    selectedCourseCode,

    setSearchQuery,
    setTermCodes,
    setDepartmentPrefixes,
    setProfessorExternalIds,
    setDays,
    setAcademicLevels,
    setSelectedCourseCode,
    setTimeRange,
    setRsgKeys,
    setPanelTab,
    setFilters,
    clearFilters,

    options,
  };
}
