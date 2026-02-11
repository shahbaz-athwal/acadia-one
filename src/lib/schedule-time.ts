/**
 * Schedule time utilities for converting time strings to grid positions
 * and formatting times for display.
 */

/** The earliest hour shown on the calendar grid. */
export const GRID_START_HOUR = 3;

/** The latest hour shown on the calendar grid. */
export const GRID_END_HOUR = 21; // 9:00 PM

/** Total number of 30-minute slots in the grid. */
export const SLOT_COUNT = (GRID_END_HOUR - GRID_START_HOUR) * 2; // 26

/** Height of a single 30-minute slot in pixels. */
export const SLOT_HEIGHT = 60;

/** Width of the time gutter column in pixels. */
export const TIME_GUTTER_WIDTH = 56;

/** Weekday labels indexed by the day number used in the schema (1=Mon, 5=Fri). */
export const WEEKDAYS = [
  { day: 1, short: "Mon", long: "Monday" },
  { day: 2, short: "Tue", long: "Tuesday" },
  { day: 3, short: "Wed", long: "Wednesday" },
  { day: 4, short: "Thu", long: "Thursday" },
  { day: 5, short: "Fri", long: "Friday" },
] as const;

const AMPM_REGEX = /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|a\.m\.|p\.m\.)$/;
const TIME_24H_REGEX = /^(\d{1,2}):(\d{2})$/;

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
 * the top of the grid (where GRID_START_HOUR begins).
 */
export function minutesToPixelOffset(minutes: number): number {
  const gridStartMinutes = GRID_START_HOUR * 60;
  const elapsed = minutes - gridStartMinutes;
  return (elapsed / 30) * SLOT_HEIGHT;
}

/**
 * Get the top offset and height in pixels for a schedule block.
 */
export function getBlockPosition(
  startTime: string,
  endTime: string
): { top: number; height: number } {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const top = minutesToPixelOffset(startMinutes);
  const height = ((endMinutes - startMinutes) / 30) * SLOT_HEIGHT;
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
  return `${hours12}:${mins.toString().padStart(2, "0")} ${period}`;
}

/**
 * Generate the time labels for the left gutter.
 * Returns labels at 30-minute increments from GRID_START_HOUR to GRID_END_HOUR.
 */
export function getTimeSlots(): Array<{
  minutes: number;
  label: string;
  isHour: boolean;
}> {
  const slots: Array<{ minutes: number; label: string; isHour: boolean }> = [];
  for (let m = GRID_START_HOUR * 60; m < GRID_END_HOUR * 60; m += 30) {
    slots.push({
      minutes: m,
      label: formatTime(m),
      isHour: m % 60 === 0,
    });
  }
  return slots;
}
