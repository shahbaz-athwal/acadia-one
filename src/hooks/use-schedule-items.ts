import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { getOrCreateSessionId } from "./use-auth";
import { useScheduleView } from "./use-schedule-view";

export type ScheduleItem = NonNullable<
  ReturnType<typeof useScheduleItems>["items"]
>[number];

export function useScheduleItems() {
  const sessionId = getOrCreateSessionId();
  const { termCode } = useScheduleView();

  const { data: allItems } = useSuspenseQuery(
    convexQuery(api.schedule.get, { sessionId })
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
