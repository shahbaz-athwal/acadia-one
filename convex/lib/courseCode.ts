const SUBJECT_PATTERN = "[A-Za-z]{2,6}";
const SEPARATED_NUMBER_PATTERN = "[A-Za-z0-9]{2,6}";
const COMPACT_NUMBER_PATTERN = "[0-9]{3,4}[A-Za-z]?";
const CONTAINS_DIGIT_REGEX = /\d/;
const SINGLE_COURSE_CODE_REGEX = new RegExp(
  `\\b(${SUBJECT_PATTERN})(?:\\s*(?:-\\s*|\\s+)(${SEPARATED_NUMBER_PATTERN})|(${COMPACT_NUMBER_PATTERN}))\\b`,
  "i",
);

function buildCanonicalCourseCode(subject: string, number: string): string {
  return `${subject.trim().toUpperCase()}-${number.trim().toUpperCase()}`;
}

export function parseCanonicalCourseCode(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(SINGLE_COURSE_CODE_REGEX);
  if (!match) {
    return null;
  }

  const subject = match[1];
  const number = match[2] ?? match[3];
  if (!(subject && number && CONTAINS_DIGIT_REGEX.test(number))) {
    return null;
  }

  return buildCanonicalCourseCode(subject, number);
}
