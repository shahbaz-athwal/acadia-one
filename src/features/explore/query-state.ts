"use client";

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

import { normalizeTimeRange } from "@/features/explore/time";

const SORT_KEYS = ["title", "difficulty", "numRatings", "courseLevel"] as const;
const SORT_DIRECTIONS = ["asc", "desc"] as const;
const VIEW_VALUES = ["grid", "table"] as const;

const TIME_MINUTES_MIN = 8 * 60; // 8:00 AM
const TIME_MINUTES_MAX = 21 * 60; // 9:00 PM
const TIME_STEP_MINUTES = 15;

// Types
type ExploreTerm = string;
type ExploreView = (typeof VIEW_VALUES)[number];

type ExploreTimeRange = {
  start: number;
  end: number;
};

type ExploreFilters = {
  term: ExploreTerm[];
  professorIds: string[];
  subjectIds: string[];
  academicLevels: number[];
  time: ExploreTimeRange | null;
};

type ExploreSort = {
  key: (typeof SORT_KEYS)[number];
  dir: (typeof SORT_DIRECTIONS)[number];
};

type ExploreState = {
  filters: ExploreFilters;
  search: string;
  sort: ExploreSort;
  view: ExploreView;
};

const DEFAULT_EXPLORE_STATE: ExploreState = {
  filters: {
    term: [],
    professorIds: [],
    subjectIds: [],
    academicLevels: [],
    time: null,
  },
  search: "",
  sort: {
    key: "title",
    dir: "asc",
  },
  view: "grid",
};

function useExploreQueryState() {
  const [query, setQuery] = useQueryStates(
    {
      search: parseAsString.withDefault(""),
      view: parseAsStringLiteral(VIEW_VALUES).withDefault(
        DEFAULT_EXPLORE_STATE.view
      ),
      sortKey: parseAsStringLiteral(SORT_KEYS).withDefault(
        DEFAULT_EXPLORE_STATE.sort.key
      ),
      sortDir: parseAsStringLiteral(SORT_DIRECTIONS).withDefault(
        DEFAULT_EXPLORE_STATE.sort.dir
      ),
      term: parseAsArrayOf(parseAsString).withDefault([]),
      professorIds: parseAsArrayOf(parseAsString).withDefault([]),
      subjectIds: parseAsArrayOf(parseAsString).withDefault([]),
      academicLevels: parseAsArrayOf(parseAsInteger).withDefault([]),
      timeStart: parseAsInteger,
      timeEnd: parseAsInteger,
    },
    {
      history: "replace",
      urlKeys: {
        search: "search",
        view: "view",
        sortKey: "sort",
        sortDir: "dir",
        term: "term",
        professorIds: "prof",
        subjectIds: "sub",
        academicLevels: "lvl",
        timeStart: "ts",
        timeEnd: "te",
      },
    }
  );

  const time =
    query.timeStart == null && query.timeEnd == null
      ? null
      : normalizeTimeRange(
          {
            start: query.timeStart ?? TIME_MINUTES_MIN,
            end: query.timeEnd ?? TIME_MINUTES_MAX,
          },
          query.timeStart != null ? "start" : "end"
        );

  const state: ExploreState = {
    filters: {
      term: query.term,
      professorIds: query.professorIds,
      subjectIds: query.subjectIds,
      academicLevels: query.academicLevels,
      time,
    },
    search: query.search,
    sort: { key: query.sortKey, dir: query.sortDir },
    view: query.view,
  };

  const setFilters = (updater: (prev: ExploreFilters) => ExploreFilters) => {
    const nextFilters = updater(state.filters);

    setQuery({
      term: nextFilters.term,
      professorIds: nextFilters.professorIds,
      subjectIds: nextFilters.subjectIds,
      academicLevels: nextFilters.academicLevels,
      timeStart: nextFilters.time?.start ?? null,
      timeEnd: nextFilters.time?.end ?? null,
    });
  };

  const setSearch = (search: string) => {
    setQuery({ search });
  };

  const setSort = (sort: ExploreSort) => {
    setQuery({ sortKey: sort.key, sortDir: sort.dir });
  };

  const setView = (view: ExploreView) => {
    setQuery({ view });
  };

  return {
    state,
    setFilters,
    setSearch,
    setSort,
    setView,
  };
}

export { useExploreQueryState };
export {
  DEFAULT_EXPLORE_STATE,
  SORT_KEYS,
  SORT_DIRECTIONS,
  VIEW_VALUES,
  TIME_MINUTES_MIN,
  TIME_MINUTES_MAX,
  TIME_STEP_MINUTES,
};
export type {
  ExploreState,
  ExploreFilters,
  ExploreSort,
  ExploreView,
  ExploreTerm,
  ExploreTimeRange,
};
