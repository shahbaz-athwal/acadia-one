/** Weekday labels indexed by the day number used in the schema (1=Mon, 5=Fri). */
export const WEEKDAYS = [
  { day: 1, short: "Mon", long: "Monday" },
  { day: 2, short: "Tue", long: "Tuesday" },
  { day: 3, short: "Wed", long: "Wednesday" },
  { day: 4, short: "Thu", long: "Thursday" },
  { day: 5, short: "Fri", long: "Friday" },
] as const;

export interface ConflictCheckSection {
  id: string;
  termCode: string;
  sectionCode: string;
  classStartTime: string;
  classEndTime: string;
  days: number[];
}

export interface ConflictOverlap {
  day: number;
  overlapStartMinutes: number;
  overlapEndMinutes: number;
  overlapStartTime: string;
  overlapEndTime: string;
}

export interface SectionConflict<
  T extends ConflictCheckSection = ConflictCheckSection,
> {
  sectionA: T;
  sectionB: T;
  sharedDays: number[];
  overlaps: ConflictOverlap[];
}

export interface ConflictCheckResult<
  T extends ConflictCheckSection = ConflictCheckSection,
> {
  hasConflicts: boolean;
  conflicts: SectionConflict<T>[];
}

const AMPM_REGEX = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm|a\.m\.|p\.m\.)$/;
const TIME_24H_REGEX = /^(\d{1,2}):(\d{2})$/;

interface NormalizedConflictSection<T extends ConflictCheckSection> {
  section: T;
  startMinutes: number;
  endMinutes: number;
  days: number[];
}

function parseAmPmMatch(match: RegExpMatchArray): number | null {
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const period = match[3]?.toLowerCase().replace(/\./g, "");

  if (!period || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  let normalizedHours = hours;
  if (period === "am") {
    normalizedHours = hours === 12 ? 0 : hours;
  } else if (hours !== 12) {
    normalizedHours = hours + 12;
  }

  return normalizedHours * 60 + minutes;
}

function parse24HourMatch(match: RegExpMatchArray): number | null {
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Parse a display time string into total minutes since midnight.
 * Accepts formats: "10 AM", "10:00 AM", "2:30 PM", "14:30", "09:00"
 */
export function parseTimeToMinutesOrNull(time: string): number | null {
  const trimmed = time.trim();
  const ampmMatch = trimmed.match(AMPM_REGEX);
  if (ampmMatch) {
    return parseAmPmMatch(ampmMatch);
  }

  const match24 = trimmed.match(TIME_24H_REGEX);
  if (match24) {
    return parse24HourMatch(match24);
  }

  return null;
}

/**
 * Parse a display time string into total minutes since midnight.
 * Returns 0 for invalid inputs to preserve legacy frontend behavior.
 */
export function parseTimeToMinutes(time: string): number {
  return parseTimeToMinutesOrNull(time) ?? 0;
}

/**
 * Format minutes since midnight to a display string like "8:00 AM".
 */
export function formatTime(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  let hours12: number;
  if (hours24 === 0) {
    hours12 = 12;
  } else if (hours24 > 12) {
    hours12 = hours24 - 12;
  } else {
    hours12 = hours24;
  }
  if (mins === 0) {
    return `${hours12} ${period}`;
  }
  return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
}

export function getWeekdayLongName(day: number): string {
  return WEEKDAYS.find((weekday) => weekday.day === day)?.long ?? `Day ${day}`;
}

export function getWeekdayShortName(day: number): string {
  return WEEKDAYS.find((weekday) => weekday.day === day)?.short ?? `Day ${day}`;
}

export function formatWeekdayNames(
  days: number[],
  style: "long" | "short" = "long"
): string[] {
  const names = days.map((day) =>
    style === "long" ? getWeekdayLongName(day) : getWeekdayShortName(day)
  );
  return [...new Set(names)];
}

function normalizeConflictSection<T extends ConflictCheckSection>(
  section: T
): NormalizedConflictSection<T> | null {
  const startMinutes = parseTimeToMinutesOrNull(section.classStartTime);
  const endMinutes = parseTimeToMinutesOrNull(section.classEndTime);
  const days = [...new Set(section.days)].sort((a, b) => a - b);

  if (
    startMinutes === null ||
    endMinutes === null ||
    days.length === 0 ||
    endMinutes <= startMinutes
  ) {
    return null;
  }

  return {
    section,
    startMinutes,
    endMinutes,
    days,
  };
}

function intersectSortedDays(daysA: number[], daysB: number[]): number[] {
  const sharedDays: number[] = [];
  let indexA = 0;
  let indexB = 0;

  while (indexA < daysA.length && indexB < daysB.length) {
    const dayA = daysA[indexA];
    const dayB = daysB[indexB];

    if (dayA === dayB) {
      sharedDays.push(dayA);
      indexA += 1;
      indexB += 1;
      continue;
    }

    if (dayA < dayB) {
      indexA += 1;
    } else {
      indexB += 1;
    }
  }

  return sharedDays;
}

export function checkForConflicts<T extends ConflictCheckSection>(
  sections: T[]
): ConflictCheckResult<T> {
  const normalizedSections = sections.map(normalizeConflictSection);
  const conflicts: SectionConflict<T>[] = [];

  for (let indexA = 0; indexA < normalizedSections.length; indexA += 1) {
    const sectionA = normalizedSections[indexA];
    if (!sectionA) {
      continue;
    }

    for (
      let indexB = indexA + 1;
      indexB < normalizedSections.length;
      indexB += 1
    ) {
      const sectionB = normalizedSections[indexB];
      if (
        !sectionB ||
        sectionA.section.termCode !== sectionB.section.termCode
      ) {
        continue;
      }

      const sharedDays = intersectSortedDays(sectionA.days, sectionB.days);
      if (sharedDays.length === 0) {
        continue;
      }

      const overlapStartMinutes = Math.max(
        sectionA.startMinutes,
        sectionB.startMinutes
      );
      const overlapEndMinutes = Math.min(
        sectionA.endMinutes,
        sectionB.endMinutes
      );
      if (overlapStartMinutes >= overlapEndMinutes) {
        continue;
      }

      const overlaps = sharedDays.map((day) => ({
        day,
        overlapStartMinutes,
        overlapEndMinutes,
        overlapStartTime: formatTime(overlapStartMinutes),
        overlapEndTime: formatTime(overlapEndMinutes),
      }));

      conflicts.push({
        sectionA: sectionA.section,
        sectionB: sectionB.section,
        sharedDays: overlaps.map((overlap) => overlap.day),
        overlaps,
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}
