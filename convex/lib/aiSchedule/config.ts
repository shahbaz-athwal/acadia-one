export function getTreatInProgressAsSatisfiedFlag() {
  const rawValue =
    process.env.AI_SCHEDULE_TREAT_IN_PROGRESS_AS_SATISFIED?.trim().toLowerCase();

  return rawValue === "1" || rawValue === "true" || rawValue === "yes";
}

export function normalizePlannerOptions(options?: {
  targetCourseCount?: number;
}) {
  const targetCourseCount = options?.targetCourseCount;

  return {
    targetCourseCount:
      typeof targetCourseCount === "number" &&
      Number.isFinite(targetCourseCount) &&
      targetCourseCount > 0
        ? Math.round(targetCourseCount)
        : 5,
  };
}
