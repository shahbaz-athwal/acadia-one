import {
  type ExploreTimeRange,
  TIME_MINUTES_MAX,
  TIME_MINUTES_MIN,
  TIME_STEP_MINUTES,
} from "@/features/explore/query-state";

function clampMinutes(value: number) {
  return Math.min(TIME_MINUTES_MAX, Math.max(TIME_MINUTES_MIN, value));
}

function roundToStep(value: number) {
  const rounded = Math.round(value / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  return clampMinutes(rounded);
}

function formatMinutes(minutes: number) {
  const total = clampMinutes(roundToStep(minutes));
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;

  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  const minuteLabel = minute.toString().padStart(2, "0");

  return `${hour12}:${minuteLabel} ${period}`;
}

function formatMinutes24(minutes: number) {
  const total = clampMinutes(roundToStep(minutes));
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  return `${hour24.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

function buildTimeOptions() {
  const options: Array<{ value: number; label: string }> = [];
  for (
    let value = TIME_MINUTES_MIN;
    value <= TIME_MINUTES_MAX;
    value += TIME_STEP_MINUTES
  ) {
    options.push({ value, label: formatMinutes(value) });
  }
  return options;
}

function normalizeTimeRange(
  next: ExploreTimeRange,
  changed: "start" | "end"
): ExploreTimeRange {
  let start = clampMinutes(roundToStep(next.start));
  let end = clampMinutes(roundToStep(next.end));

  if (changed === "start" && start > end) {
    end = start;
  }
  if (changed === "end" && end < start) {
    start = end;
  }

  return { start, end };
}

export { buildTimeOptions, formatMinutes, formatMinutes24, normalizeTimeRange };
