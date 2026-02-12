import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
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

  const { data: allItems } = useSuspenseQuery(
    convexQuery(api.addToSchedule.get, { sessionId })
  );

  const items = useMemo(() => {
    if (!termCode) {
      return undefined;
    }
    return allItems.filter((item) => item.section.termCode === termCode);
  }, [allItems, termCode]);

  const termCodesInSchedule = useMemo(() => {
    return [...new Set(allItems.map((item) => item.section.termCode))];
  }, [allItems]);

  return {
    items,
    allItems,
    termCodesInSchedule,
    sessionId,
  };
}
