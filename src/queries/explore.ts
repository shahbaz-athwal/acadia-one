import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";

export const PAGE_SIZE = 10;

export function buildConvexFilters(search: {
  term: string[];
  dept: string[];
  prof: string[];
  day: number[];
  rsg: string[];
}) {
  const f: Record<string, string[] | number[]> = {};
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
  if (search.rsg.length > 0) {
    f.rsgKeys = [...search.rsg].sort();
  }
  return Object.keys(f).length > 0 ? f : undefined;
}

export const filterOptionsQuery = () =>
  convexQuery(api.explore.filterOptions, {});

export const scheduleQuery = (sessionId: string) =>
  convexQuery(api.schedule.get, { sessionId });

export const coursesQuery = (params: {
  page: number;
  filters: ReturnType<typeof buildConvexFilters>;
  searchQuery: string;
}) =>
  convexQuery(api.courses.listForExplore, {
    ...params,
    pageSize: PAGE_SIZE,
  });

export const validateSessionQuery = (sessionId: string, tokenHash: string) =>
  convexQuery(api.sessions.validateSession, { sessionId, tokenHash });

export const userDataQuery = (sessionId: string, tokenHash: string) =>
  convexQuery(api.sessions.getUserData, { sessionId, tokenHash });
