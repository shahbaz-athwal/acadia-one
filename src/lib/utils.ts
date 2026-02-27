import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

const TERM_SEASON_REGEX = /\b(Fall|Winter)\b/i;
const TERM_YEAR_REGEX = /\b(20\d{2})\b/;
const TERM_YEAR_FROM_CODE_REGEX = /(20\d{2})/;
const TERM_CONTINUOUS_REGEX = /\bcontinuous\s+intake\b/i;
const TERM_ACADEMIC_YEAR_REGEX = /\b(\d{4}\/\d{2})\b/;
const TERM_TRAILING_YEAR_REGEX = /\s+(?:20\d{2}|\d{4}\/\d{2})$/;
const WHITESPACE_REGEX = /\s+/;
const WORD_REGEX = /[A-Za-z0-9]+/g;

const DAY_LABEL_BY_VALUE = new Map<number, string>([
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
]);

const KNOWN_BUILDING_ABBREVIATIONS = new Map<string, string>([
  ["beveridge arts centre", "BAC"],
  ["carnegie hall", "CAR"],
  ["heustis innovation pavilion", "HIP"],
  ["patterson hall", "PAT"],
  ["huggins science hall", "HSH"],
  ["kc irving centre", "KCIC"],
]);

const COURSE_CODE_ALPHA_NUMERIC_REGEX = /^([A-Za-z]+)-?(\d+[A-Za-z0-9]*)$/;

function normalizeTermName(termName: string): string {
  if (TERM_CONTINUOUS_REGEX.test(termName)) {
    const academicYear = termName.match(TERM_ACADEMIC_YEAR_REGEX)?.[1];
    return academicYear ? `CI ${academicYear}` : "CI";
  }

  const seasonMatch = termName.match(TERM_SEASON_REGEX);
  const yearMatch = termName.match(TERM_YEAR_REGEX);
  if (seasonMatch && yearMatch) {
    const season =
      seasonMatch[1].slice(0, 1).toUpperCase() +
      seasonMatch[1].slice(1).toLowerCase();
    return `${season} ${yearMatch[1]}`;
  }

  return termName;
}

export function formatTermLabel(
  termCode: string,
  termNameByCode: Map<string, string>
): string {
  const mappedName = termNameByCode.get(termCode);
  if (mappedName) {
    return normalizeTermName(mappedName);
  }

  const upperCode = termCode.toUpperCase();
  let season: string | null = null;
  if (upperCode.startsWith("FA")) {
    season = "Fall";
  } else if (upperCode.startsWith("WI")) {
    season = "Winter";
  }

  const yearMatch = upperCode.match(TERM_YEAR_FROM_CODE_REGEX);
  if (season && yearMatch) {
    return `${season} ${yearMatch[1]}`;
  }

  return season ?? termCode;
}

export function formatTermLabelWithoutYear(
  termCode: string,
  termNameByCode: Map<string, string>
): string {
  return formatTermLabel(termCode, termNameByCode)
    .replace(TERM_TRAILING_YEAR_REGEX, "")
    .trim();
}

export function isCoinTerm(
  termCode: string,
  termNameByCode: Map<string, string>
): boolean {
  const upperCode = termCode.toUpperCase();
  if (upperCode.startsWith("COI") || upperCode.startsWith("COIN")) {
    return true;
  }
  const mappedName = termNameByCode.get(termCode);
  return mappedName ? TERM_CONTINUOUS_REGEX.test(mappedName) : false;
}

export function formatDays(days: number[]): string {
  if (days.length === 0) {
    return "TBA";
  }
  return days
    .map((day) => DAY_LABEL_BY_VALUE.get(day) ?? String(day))
    .join(", ");
}

export function getInitials(name: string): string {
  const pieces = name.trim().split(WHITESPACE_REGEX).filter(Boolean);
  if (pieces.length === 0) {
    return "?";
  }
  return pieces
    .slice(0, 2)
    .map((piece) => piece.charAt(0).toUpperCase())
    .join("");
}

function normalizeBuildingName(name: string): string {
  return name.trim().replace(WHITESPACE_REGEX, " ").toLowerCase();
}

export function getBuildingAbbreviation(buildingName: string): string {
  const normalized = normalizeBuildingName(buildingName);
  const known = KNOWN_BUILDING_ABBREVIATIONS.get(normalized);
  if (known) {
    return known;
  }

  const words = normalized.match(WORD_REGEX) ?? [];
  const fallback = words.map((word) => word.charAt(0).toUpperCase()).join("");
  return fallback || "-";
}

export function formatCourseCode(code: string): string {
  const normalizedCode = code.trim().replace(WHITESPACE_REGEX, "");
  const splitCode = normalizedCode.match(COURSE_CODE_ALPHA_NUMERIC_REGEX);
  if (!splitCode) {
    return code;
  }
  return `${splitCode[1]}-${splitCode[2]}`;
}
