/**
 * Local course codes look like `APSC-1113` or `APSC-1070L`. Rate My Professors
 * asks the student to type the course themselves, so that field holds anything:
 * `COMM1213`, `MAT 1213`, `PYSC2143` (typo), `HISTORY`, `WW2`, a bare `1013`.
 *
 * This pulls a canonical `SUBJ-NUMBER` out when one is in there. Returning null
 * is an ordinary outcome, not a failure — a review whose code does not parse is
 * still a review, so callers keep it and leave the course link empty.
 */

const SUBJECT_PATTERN = "[A-Za-z]{2,6}";
/** `1070L`, `2000`, and the odd `10A3` once a separator has already committed. */
const SEPARATED_NUMBER_PATTERN = "[A-Za-z0-9]{2,6}";
/**
 * Without a separator the number has to lead with digits, or `MATHSTATS` would
 * split into a subject and a "number".
 */
const COMPACT_NUMBER_PATTERN = "[0-9]{3,4}[A-Za-z]?";

const CONTAINS_DIGIT_REGEX = /\d/u;

/**
 * Global so `parseCanonicalCourseCode` can keep scanning: the first candidate in
 * `Intro to BIOL1013` is `Intro to`, whose "number" has no digit in it.
 */
const COURSE_CODE_REGEX = new RegExp(
  `\\b(?<subject>${SUBJECT_PATTERN})(?:\\s*(?:-\\s*|\\s+)(?<separated>${SEPARATED_NUMBER_PATTERN})|(?<compact>${COMPACT_NUMBER_PATTERN}))\\b`,
  "giu"
);

export function parseCanonicalCourseCode(
  raw: string | null | undefined
): string | null {
  const trimmed = raw?.trim();

  if (trimmed === undefined || trimmed.length === 0) {
    return null;
  }

  // `lastIndex` is shared state on a module-level global regex, so every call
  // has to start it over.
  COURSE_CODE_REGEX.lastIndex = 0;

  let match = COURSE_CODE_REGEX.exec(trimmed);

  while (match !== null) {
    const { groups } = match;
    const subject = groups?.subject;
    const number = groups?.separated ?? groups?.compact;

    if (
      subject !== undefined &&
      number !== undefined &&
      CONTAINS_DIGIT_REGEX.test(number)
    ) {
      return `${subject.toUpperCase()}-${number.toUpperCase()}`;
    }

    match = COURSE_CODE_REGEX.exec(trimmed);
  }

  return null;
}
