import { formatTime, parseTimeToMinutes } from "../../shared/schedule-time";

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
