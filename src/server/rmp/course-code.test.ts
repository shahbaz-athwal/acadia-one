import { expect, test } from "bun:test";

import { parseCanonicalCourseCode } from "./course-code";

test("passes through a code already in canonical form", () => {
  expect(parseCanonicalCourseCode("APSC-1113")).toBe("APSC-1113");
  expect(parseCanonicalCourseCode("APSC-1070L")).toBe("APSC-1070L");
});

test("separates the compact form students actually type", () => {
  expect(parseCanonicalCourseCode("COMM1213")).toBe("COMM-1213");
  expect(parseCanonicalCourseCode("GEO1010L")).toBe("GEO-1010L");
});

test("accepts a space or a spaced hyphen as the separator", () => {
  expect(parseCanonicalCourseCode("MAT 1213")).toBe("MAT-1213");
  expect(parseCanonicalCourseCode("MATH - 1013")).toBe("MATH-1013");
});

test("upper-cases and trims", () => {
  expect(parseCanonicalCourseCode("  math1013  ")).toBe("MATH-1013");
});

/** A typo'd subject still parses; whether it resolves is the caller's problem. */
test("does not require the subject to be a real one", () => {
  expect(parseCanonicalCourseCode("PYSC2143")).toBe("PYSC-2143");
});

test("keeps scanning past a candidate whose number has no digits", () => {
  expect(parseCanonicalCourseCode("Intro to BIOL1013")).toBe("BIOL-1013");
});

test("returns null when there is no code to find", () => {
  for (const input of [
    "HISTORY",
    "MATHSTATS",
    "ACCOUNTING",
    "WW2",
    "1013",
    "2050L",
    "",
    "   ",
    null,
    undefined,
  ]) {
    expect(parseCanonicalCourseCode(input)).toBeNull();
  }
});

/** The regex is module-level and global, so a stale `lastIndex` would show here. */
test("is not stateful across calls", () => {
  expect(parseCanonicalCourseCode("COMM1213")).toBe("COMM-1213");
  expect(parseCanonicalCourseCode("COMM1213")).toBe("COMM-1213");
  expect(parseCanonicalCourseCode("COMM1213")).toBe("COMM-1213");
});
