import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { withSearchDefaults as withDefaults } from "@/routes/explore";
import { api } from "../../convex/_generated/api";

const routeApi = getRouteApi("/explore");

export type ScheduleViewMode = "calendar" | "agenda";

export function useScheduleView() {
  const search = routeApi.useSearch({
    select: (state) => ({
      sv: state.sv,
      st: state.st,
    }),
  });
  const navigate = useNavigate();
  const terms = useQuery(api.terms.list);

  const view = search.sv;
  const selectedTermCode = search.st;

  // Terms are sorted by startDate descending (newest first) from the backend.
  // Determine the effective term: use the selected one if valid, otherwise
  // fall back to the first active term (or the first term overall).
  const { termCode, termIndex, termName } = useMemo(() => {
    if (!terms || terms.length === 0) {
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
    const idx = activeIdx !== -1 ? activeIdx : 0;
    return {
      termCode: terms[idx].code,
      termIndex: idx,
      termName: terms[idx].name,
    };
  }, [terms, selectedTermCode]);

  const canGoNext = terms != null && termIndex > 0;
  const canGoPrev = terms != null && termIndex < terms.length - 1;

  const setView = (mode: ScheduleViewMode) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), sv: mode }),
    });
  };

  const setTermCode = (code: string) => {
    navigate({
      to: "/explore",
      search: (prev) => ({ ...withDefaults(prev), st: code }),
    });
  };

  // Terms are sorted newest-first, so "next" means a newer term (lower index)
  const goToNextTerm = () => {
    if (canGoNext && terms) {
      setTermCode(terms[termIndex - 1].code);
    }
  };

  // "prev" means an older term (higher index)
  const goToPrevTerm = () => {
    if (canGoPrev && terms) {
      setTermCode(terms[termIndex + 1].code);
    }
  };

  return {
    view,
    termCode,
    termName,
    terms,

    setView,
    setTermCode,
    goToNextTerm,
    goToPrevTerm,
    canGoNext,
    canGoPrev,
  };
}
