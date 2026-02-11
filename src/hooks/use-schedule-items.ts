import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { useScheduleView } from "./use-schedule-view";
import { useSessionId } from "./use-session-id";

export type ScheduleItem = NonNullable<
  ReturnType<typeof useScheduleItems>["items"]
>[number];

export function useScheduleItems() {
  const sessionId = useSessionId();
  const { termCode } = useScheduleView();

  const allItems = useQuery(api.addToSchedule.get, { sessionId });

  const items = useMemo(() => {
    if (!(allItems && termCode)) {
      return undefined;
    }
    return allItems.filter((item) => item.section.termCode === termCode);
  }, [allItems, termCode]);

  // Collect the distinct term codes across all schedule items
  const termCodesInSchedule = useMemo(() => {
    if (!allItems) {
      return [];
    }
    return [...new Set(allItems.map((item) => item.section.termCode))];
  }, [allItems]);

  return {
    items,
    allItems,
    termCodesInSchedule,
    isLoading: allItems === undefined,
    sessionId,
  };
}
