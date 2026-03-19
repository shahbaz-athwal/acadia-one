/**
 * Schedule time utilities for converting time strings to grid positions
 * and formatting times for display.
 */

/** Grid start in minutes since midnight (7:30 AM — half-slot before 8 AM so the label isn't clipped). */
export const GRID_START_MINUTES = 7 * 60 + 30;

/** Grid end in minutes since midnight (9:00 PM). */
export const GRID_END_MINUTES = 22 * 60 + 30;

/** Total number of 30-minute slots in the grid. */
export const SLOT_COUNT = (GRID_END_MINUTES - GRID_START_MINUTES) / 30; // 27

/** Height of a single 30-minute slot in pixels. */
export const SLOT_HEIGHT = 45;

/** Width of the time gutter column in pixels. */
export const TIME_GUTTER_WIDTH = 42;

/** Height of the sticky day-header row in pixels. */
export const HEADER_HEIGHT = 32;

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

const AMPM_REGEX = /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|a\.m\.|p\.m\.)$/;
const TIME_24H_REGEX = /^(\d{1,2}):(\d{2})$/;

interface NormalizedConflictSection<T extends ConflictCheckSection> {
  section: T;
  startMinutes: number;
  endMinutes: number;
  days: number[];
}

/**
 * Parse a display time string into total minutes since midnight.
 * Accepts formats: "10:00 AM", "2:30 PM", "14:30", "09:00"
 */
export function parseTimeToMinutes(time: string): number {
  const trimmed = time.trim();
  const ampmMatch = trimmed.match(AMPM_REGEX);
  if (ampmMatch) {
    let hours = Number.parseInt(ampmMatch[1], 10);
    const minutes = Number.parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toLowerCase().replace(/\./g, "");
    if (period === "pm" && hours !== 12) {
      hours += 12;
    }
    if (period === "am" && hours === 12) {
      hours = 0;
    }
    return hours * 60 + minutes;
  }

  // 24-hour format: "14:30"
  const match24 = trimmed.match(TIME_24H_REGEX);
  if (match24) {
    return (
      Number.parseInt(match24[1], 10) * 60 + Number.parseInt(match24[2], 10)
    );
  }

  return 0;
}

/**
 * Convert total minutes since midnight to a Y-pixel offset relative to
 * the top of the grid body (where GRID_START_MINUTES begins).
 */
export function minutesToPixelOffset(
  minutes: number,
  slotHeight: number = SLOT_HEIGHT
): number {
  const elapsed = minutes - GRID_START_MINUTES;
  return (elapsed / 30) * slotHeight;
}

/**
 * Get the top offset and height in pixels for a schedule block.
 */
export function getBlockPosition(
  startTime: string,
  endTime: string,
  slotHeight: number = SLOT_HEIGHT
): { top: number; height: number } {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const top = minutesToPixelOffset(startMinutes, slotHeight);
  const height = ((endMinutes - startMinutes) / 30) * slotHeight;
  return { top, height };
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

function normalizeConflictSection<T extends ConflictCheckSection>(
  section: T
): NormalizedConflictSection<T> | null {
  const startMinutes = parseTimeToMinutes(section.classStartTime);
  const endMinutes = parseTimeToMinutes(section.classEndTime);
  const days = [...new Set(section.days)].sort((a, b) => a - b);

  if (days.length === 0 || endMinutes <= startMinutes) {
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
      if (!sectionB || sectionA.section.termCode !== sectionB.section.termCode) {
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

/**
 * Generate the time labels for the left gutter.
 * Returns labels at 30-minute increments from GRID_START_MINUTES to GRID_END_MINUTES.
 */
export function getTimeSlots(): Array<{
  minutes: number;
  label: string;
  isHour: boolean;
}> {
  const slots: Array<{ minutes: number; label: string; isHour: boolean }> = [];
  for (let m = GRID_START_MINUTES; m < GRID_END_MINUTES; m += 30) {
    slots.push({
      minutes: m,
      label: formatTime(m),
      isHour: m % 60 === 0,
    });
  }
  return slots;
}
