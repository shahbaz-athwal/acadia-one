import { describe, expect, test } from "bun:test";
import { parseCanonicalCourseCode } from "./courseCode";

const normalizeRmpCourseCode = (courseCode: string | null | undefined) =>
  parseCanonicalCourseCode(courseCode) ?? undefined;

function classifyRatings(
  rawCourseCodes: Array<string | null | undefined>,
  knownCourseCodes: Set<string>
) {
  const rejected: string[] = [];
  const unmatched: Array<{ raw: string; normalized: string }> = [];
  const matched: Array<{ raw: string; normalized: string }> = [];

  for (const rawCourseCode of rawCourseCodes) {
    const normalized = normalizeRmpCourseCode(rawCourseCode);
    if (!normalized) {
      rejected.push(rawCourseCode ?? "");
      continue;
    }

    if (!knownCourseCodes.has(normalized)) {
      unmatched.push({ raw: rawCourseCode ?? "", normalized });
      continue;
    }

    matched.push({ raw: rawCourseCode ?? "", normalized });
  }

  return { rejected, unmatched, matched };
}

describe("parseCanonicalCourseCode", () => {
  test("accepts real RMP course strings that should map cleanly", () => {
    expect(parseCanonicalCourseCode("ECON1013")).toBe("ECON-1013");
    expect(parseCanonicalCourseCode("PHIL1406")).toBe("PHIL-1406");
    expect(parseCanonicalCourseCode("DATAC3413")).toBe("DATAC-3413");
  });

  test("rejects malformed or subjectless RMP course strings", () => {
    expect(parseCanonicalCourseCode("1023")).toBeNull();
    expect(parseCanonicalCourseCode("PHIL")).toBeNull();
    expect(parseCanonicalCourseCode("PHILA")).toBeNull();
    expect(parseCanonicalCourseCode("2033X2")).toBeNull();
    expect(parseCanonicalCourseCode("OOAD")).toBeNull();
  });

  test("separates rejected codes from parsed-but-unmatched codes", () => {
    const result = classifyRatings(
      [
        "ECON1013",
        "1023",
        "ECON1023",
        "BUIS1023",
        "PHIL",
        "PHIL1413",
        "CS3043",
        "COMP2203",
        "OOAD",
      ],
      new Set(["ECON-1013", "ECON-1023", "PHIL-1413", "COMP-2203"])
    );

    expect(result.matched).toEqual([
      { raw: "ECON1013", normalized: "ECON-1013" },
      { raw: "ECON1023", normalized: "ECON-1023" },
      { raw: "PHIL1413", normalized: "PHIL-1413" },
      { raw: "COMP2203", normalized: "COMP-2203" },
    ]);
    expect(result.unmatched).toEqual([
      { raw: "BUIS1023", normalized: "BUIS-1023" },
      { raw: "CS3043", normalized: "CS-3043" },
    ]);
    expect(result.rejected).toEqual(["1023", "PHIL", "OOAD"]);
  });
});
