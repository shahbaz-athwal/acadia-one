import { convexQuery } from "@convex-dev/react-query";
import { TIME_RANGE_MAX_MINUTES, TIME_RANGE_MINUTES } from "@/lib/explore-filter-constants";
import { api } from "../../convex/_generated/api";

export const PAGE_SIZE = 10;

export function buildConvexFilters(search: {
  term: string[];
  dept: string[];
  prof: string[];
  day: number[];
  lvl: number[];
  rsg: string[];
  ts: number;
  te: number;
}) {
  const f: Record<string, string[] | number[] | number> = {};
  if (search.term.length > 0) {
    f.termCodes = [...search.term].sort();
  }
  if (search.dept.length > 0) {
    f.departmentPrefixes = [...search.dept].sort();
  }
  if (search.prof.length > 0) {
    f.professorExternalIds = [...search.prof].sort();
  }
  if (search.day.length > 0) {
    f.days = [...search.day].sort((a, b) => a - b);
  }
  if (search.lvl.length > 0) {
    f.academicLevels = [...search.lvl].sort((a, b) => a - b);
  }
  const defaultStart = TIME_RANGE_MINUTES;
  const defaultEnd = TIME_RANGE_MAX_MINUTES;
  if (search.ts !== defaultStart || search.te !== defaultEnd) {
    f.timeStart = Math.min(search.ts, search.te);
    f.timeEnd = Math.max(search.ts, search.te);
  }
  if (search.rsg.length > 0) {
    f.rsgKeys = [...search.rsg].sort();
  }
  return Object.keys(f).length > 0 ? f : undefined;
}

export const filterOptionsQuery = () => convexQuery(api.explore.filterOptions, {});

export const scheduleQuery = (sessionId: string) => convexQuery(api.schedule.get, { sessionId });

export const coursesQuery = (params: {
  page: number;
  courseCode?: string;
  filters: ReturnType<typeof buildConvexFilters>;
  searchQuery: string;
}) =>
  convexQuery(api.courses.listForExplore, {
    ...params,
    pageSize: PAGE_SIZE,
  });

export const courseSheetQuery = (code: string) => convexQuery(api.courses.getSheetByCode, { code });

export const professorSheetQuery = (externalId: string) =>
  convexQuery(api.professors.getSheetByExternalId, { externalId });

export const validateSessionQuery = (sessionId: string, tokenHash: string) =>
  convexQuery(api.sessions.validateSession, { sessionId, tokenHash });

export const userDataQuery = (sessionId: string, tokenHash: string) =>
  convexQuery(api.sessions.getUserData, { sessionId, tokenHash });

export const progressSearchCoursesQuery = (sessionId: string, tokenHash: string) =>
  convexQuery(api.sessions.getProgressSearchCourses, { sessionId, tokenHash });
