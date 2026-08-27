const numberFormatter = new Intl.NumberFormat("en-CA");
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

const BYTES_PER_UNIT = 1024;
const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

export type MaybeDate = Date | string | null | undefined;

export function toDate(value: MaybeDate) {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatDate(value: MaybeDate) {
  const date = toDate(value);

  return date === null ? "—" : dateFormatter.format(date);
}

export function formatDateTime(value: MaybeDate) {
  const date = toDate(value);

  return date === null ? "—" : dateTimeFormatter.format(date);
}

export function formatBytes(value: number) {
  let size = value;
  let unitIndex = 0;

  while (size >= BYTES_PER_UNIT && unitIndex < BYTE_UNITS.length - 1) {
    size /= BYTES_PER_UNIT;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${BYTE_UNITS[unitIndex]}`;
}

export function formatDuration(from: MaybeDate, to: MaybeDate) {
  const start = toDate(from);
  const end = toDate(to);

  if (start === null || end === null) {
    return "—";
  }

  const seconds = Math.round(
    (end.getTime() - start.getTime()) / MILLISECONDS_PER_SECOND
  );

  if (seconds < SECONDS_PER_MINUTE) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);

  return `${minutes}m ${seconds % SECONDS_PER_MINUTE}s`;
}

export function formatCounts(counts: Record<string, number> | null) {
  if (counts === null) {
    return "—";
  }

  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return "—";
  }

  return entries
    .map(([key, value]) => `${key}: ${formatNumber(value)}`)
    .join(", ");
}
