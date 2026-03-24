import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { filterOptionsQuery } from "@/queries/explore";
import { withSearchDefaults as withDefaults } from "@/routes/explore";

const routeApi = getRouteApi("/explore");

export function useScheduleView() {
  const search = routeApi.useSearch({
    select: (state) => ({
      st: state.st,
    }),
  });
  const navigate = useNavigate();
  const {
    data: { terms },
  } = useSuspenseQuery(filterOptionsQuery());

  const selectedTermCode = search.st;

  // Terms are sorted by startDate descending (newest first) from the backend.
  // Determine the effective term: use the selected one if valid, otherwise
  // fall back to the first active term (or the first term overall).
  const { termCode, termIndex, termName } = useMemo(() => {
    if (terms.length === 0) {
      return { termCode: "", termIndex: -1, termName: "" };
    }

    // If a term is selected and exists in the list, use it
    if (selectedTermCode) {
      const idx = terms.findIndex((t) => t.code === selectedTermCode);
      if (idx !== -1) {
        return {
          termCode: terms[idx].code,
          termIndex: idx,
          termName: terms[idx].name,
        };
      }
    }

    // Default: first active term, or first term if none active
    const activeIdx = terms.findIndex((t) => t.isActive);
    const idx = activeIdx === -1 ? 0 : activeIdx;
    return {
      termCode: terms[idx].code,
      termIndex: idx,
      termName: terms[idx].name,
    };
  }, [terms, selectedTermCode]);

  const canGoNext = termIndex > 0;
  const canGoPrev = termIndex < terms.length - 1;

  const setTermCode = (code: string) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), st: code }),
    });
  };

  // Terms are sorted newest-first, so "next" means a newer term (lower index)
  const goToNextTerm = () => {
    if (canGoNext) {
      setTermCode(terms[termIndex - 1].code);
    }
  };

  // "prev" means an older term (higher index)
  const goToPrevTerm = () => {
    if (canGoPrev) {
      setTermCode(terms[termIndex + 1].code);
    }
  };

  return {
    termCode,
    termName,
    terms,

    setTermCode,
    goToNextTerm,
    goToPrevTerm,
    canGoNext,
    canGoPrev,
  };
}
