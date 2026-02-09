import { z } from "zod";

/**
 * Matches common course-code formats inside free-form requisite text.
 *
 * Examples matched:
 * - "ABC-1233"
 * - "QRST-1322"
 * - "ABC 1233"
 * - "ABC1233"
 */
function createCourseCodeRegex() {
  return /\b([A-Z]{2,6})\s*(?:-\s*|\s+)?([0-9]{3,4}[A-Z]?)\b/gi;
}

function normalizeCourseCode(subject: string, number: string) {
  return `${subject}${number}`.toUpperCase();
}

function canonicalDisplayCourseCode(subject: string, number: string) {
  return `${subject.toUpperCase()}-${number.toUpperCase()}`;
}

function dedupePreserveOrder(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Returns all normalized codes found in `text` and an annotated variant.
 *
 * Annotation token format:
 *   [[course:<NORMALIZED>|<DISPLAY>]]
 *
 * Example:
 *   "Prereq: ABC-1233, QRST-1322"
 * becomes
 *   "Prereq: [[course:ABC1233|ABC-1233]], [[course:QRST1322|QRST-1322]]"
 */
function extractCourseCodesAndAnnotate(text: string) {
  const codes: string[] = [];
  const regexForExtract = createCourseCodeRegex();

  for (const match of text.matchAll(regexForExtract)) {
    const subject = match[1];
    const number = match[2];
    if (subject == null || number == null) {
      continue;
    }
    codes.push(normalizeCourseCode(subject, number));
  }

  const regexForAnnotate = createCourseCodeRegex();
  const annotated = text.replace(
    regexForAnnotate,
    (fullMatch, subject: string, number: string) => {
      // If regex matched, subject/number are present; keep fallback for safety.
      if (subject == null || number == null) {
        return fullMatch;
      }
      const normalized = normalizeCourseCode(subject, number);
      const display = canonicalDisplayCourseCode(subject, number);
      return `[[course:${normalized}|${display}]]`;
    }
  );

  return { codes: dedupePreserveOrder(codes), annotated };
}

export const PostSearchCriteriaRequestSchema = z.object({
  keyword: z.string().nullable(),
  terms: z.array(z.string()),
  courseIds: z.null(),
  sectionIds: z.null(),
  subjects: z.array(z.string()),
  faculty: z.array(z.coerce.number()),
  pageNumber: z.number(),
  quantityPerPage: z.number(),
  group: z.string().optional(),
  requirement: z.string().optional(),
  subrequirement: z.string().optional(),
});

export const PostSearchCriteriaFilteredResponseSchema = z
  .object({
    CourseFullModels: z.array(
      z.object({
        MatchingSectionIds: z.array(z.string()),
        Id: z.string(),
        SubjectCode: z.string(),
        Number: z.string(),
        MinimumCredits: z.number(),
        Title: z.string(),
        Description: z.string(),
        CourseRequisites: z.array(
          z.object({
            DisplayText: z.string(),
            DisplayTextExtension: z.string(),
          })
        ),
      })
    ),
    TotalItems: z.number(),
    TotalPages: z.number(),
    PageSize: z.number(),
    CurrentPageIndex: z.number(),
    Subjects: z.array(
      z.object({
        Value: z.string(),
        Description: z.string(),
        Count: z.number(),
        Selected: z.boolean(),
      })
    ),
    Faculty: z.array(
      z.object({
        Value: z.string(),
        Description: z.string(),
      })
    ),
  })
  .transform((data) => ({
    courses: data.CourseFullModels.map((course) => ({
      matchingSectionIds: course.MatchingSectionIds,
      id: course.Id,
      code: course.SubjectCode + course.Number,
      subjectCode: course.SubjectCode,
      number: course.Number,
      credits: course.MinimumCredits,
      title: course.Title,
      description: course.Description,
      courseRequisites: course.CourseRequisites.map((req) => ({
        ...(() => {
          const display = extractCourseCodesAndAnnotate(req.DisplayText);
          const extension = extractCourseCodesAndAnnotate(
            req.DisplayTextExtension
          );
          const allCodes = dedupePreserveOrder([
            ...display.codes,
            ...extension.codes,
          ]);
          return {
            codes: allCodes,
            // New: tokens for frontend parsing / hover cards.
            displayTextAnnotated: display.annotated,
            displayTextExtensionAnnotated: extension.annotated,
          };
        })(),
        displayText: req.DisplayText,
        displayTextExtension: req.DisplayTextExtension,
      })),
    })),
    paging: {
      currentPageIndex: data.CurrentPageIndex,
      totalItems: data.TotalItems,
      totalPages: data.TotalPages,
      pageSize: data.PageSize,
    },
    subjects: data.Subjects.map((subject) => ({
      prefix: subject.Value,
      name: subject.Description,
    })),
    faculties: data.Faculty.map((faculty) => ({
      id: faculty.Value,
      name: faculty.Description,
    })),
  }));
