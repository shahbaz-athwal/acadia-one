import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import {
  type ExploreDetailTarget,
  formatDetailTarget,
  parseDetailTarget,
} from "@/lib/explore-detail-sheet";
import { courseSheetQuery, professorSheetQuery } from "@/queries/explore";
import { withSearchDefaults } from "@/routes/explore";

const routeApi = getRouteApi("/explore");

function normalizeCourseCode(courseCode: string) {
  return courseCode.trim().toUpperCase();
}

function normalizeProfessorExternalId(professorExternalId: string) {
  return professorExternalId.trim();
}

export function useExploreDetailSheet() {
  const { d } = routeApi.useSearch({
    select: (state) => ({
      d: state.d,
    }),
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rawDetail = d.trim();
  const target = useMemo(() => parseDetailTarget(d), [d]);

  const setDetail = useCallback(
    (nextDetail: string, replace = false) =>
      navigate({
        to: "/explore",
        replace,
        search: (prev) => ({
          ...withSearchDefaults(prev),
          d: nextDetail,
        }),
      }),
    [navigate]
  );

  const prefetchTarget = useCallback(
    (nextTarget: ExploreDetailTarget) => {
      if (nextTarget.kind === "course") {
        queryClient.prefetchQuery(courseSheetQuery(nextTarget.courseCode));
        return;
      }

      queryClient.prefetchQuery(
        professorSheetQuery(nextTarget.professorExternalId)
      );
    },
    [queryClient]
  );

  const openTarget = useCallback(
    (nextTarget: ExploreDetailTarget) => {
      const nextDetail = formatDetailTarget(nextTarget);
      if (nextDetail === rawDetail) {
        return;
      }

      setDetail(nextDetail);
    },
    [rawDetail, setDetail]
  );

  const replaceDetail = useCallback(
    (nextDetail: string) => {
      setDetail(nextDetail, true);
    },
    [setDetail]
  );

  const close = useCallback(() => {
    if (!rawDetail) {
      return;
    }

    setDetail("");
  }, [rawDetail, setDetail]);

  const openCourse = useCallback(
    (courseCode: string) => {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (!normalizedCourseCode) {
        return;
      }

      openTarget({
        kind: "course",
        courseCode: normalizedCourseCode,
      });
    },
    [openTarget]
  );

  const openProfessor = useCallback(
    (professorExternalId: string) => {
      const normalizedProfessorExternalId =
        normalizeProfessorExternalId(professorExternalId);
      if (!normalizedProfessorExternalId) {
        return;
      }

      openTarget({
        kind: "professor",
        professorExternalId: normalizedProfessorExternalId,
      });
    },
    [openTarget]
  );

  const prefetchCourse = useCallback(
    (courseCode: string) => {
      const normalizedCourseCode = normalizeCourseCode(courseCode);
      if (!normalizedCourseCode) {
        return;
      }

      prefetchTarget({
        kind: "course",
        courseCode: normalizedCourseCode,
      });
    },
    [prefetchTarget]
  );

  const prefetchProfessor = useCallback(
    (professorExternalId: string) => {
      const normalizedProfessorExternalId =
        normalizeProfessorExternalId(professorExternalId);
      if (!normalizedProfessorExternalId) {
        return;
      }

      prefetchTarget({
        kind: "professor",
        professorExternalId: normalizedProfessorExternalId,
      });
    },
    [prefetchTarget]
  );

  return {
    rawDetail,
    target,
    isOpen: target !== null,
    replaceDetail,
    openCourse,
    openProfessor,
    close,
    prefetchCourse,
    prefetchProfessor,
  };
}
