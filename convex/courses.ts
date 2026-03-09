import { ConvexError, v } from "convex/values";
import { asyncMap } from "convex-helpers";
import {
  getManyFrom,
  getManyVia,
  getOneFrom,
} from "convex-helpers/server/relationships";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";

interface TimeRange {
  start: number;
  end: number;
}

interface ResolvedFilters {
  courseCode: string;
  rsgCourseCodes: string[];
  searchQuery: string;
  departmentPrefixes: string[];
  termCodes: string[];
  professorIds: Id<"professors">[];
  days: number[];
  academicLevels: number[];
  timeRange: TimeRange | null;
}

type CourseDoc = Doc<"courses">;
type SectionDoc = Doc<"sections">;

interface CourseWithSections {
  course: CourseDoc;
  sections: SectionDoc[];
}

function normalizeCourseCode(courseCode: string): string {
  return courseCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function combineRequisiteText(base: string, extension?: string): string {
  const baseText = base.trim();
  const extensionText = extension?.trim() ?? "";
  return extensionText ? `${baseText} ${extensionText}`.trim() : baseText;
}

function normalizeTimeRange(
  startRaw?: number,
  endRaw?: number
): TimeRange | null {
  if (
    typeof startRaw !== "number" ||
    Number.isNaN(startRaw) ||
    typeof endRaw !== "number" ||
    Number.isNaN(endRaw)
  ) {
    return null;
  }

  const start = Math.max(0, Math.min(24 * 60, Math.trunc(startRaw)));
  const end = Math.max(0, Math.min(24 * 60, Math.trunc(endRaw)));
  return start <= end ? { start, end } : { start: end, end: start };
}

async function resolveFilters(
  ctx: QueryCtx,
  args: {
    courseCode?: string;
    filters?: {
      rsgKeys?: string[];
      termCodes?: string[];
      departmentPrefixes?: string[];
      professorExternalIds?: string[];
      days?: number[];
      academicLevels?: number[];
      timeStart?: number;
      timeEnd?: number;
    };
    searchQuery?: string;
  }
): Promise<ResolvedFilters> {
  const raw = args.filters;
  const rsgKeys = raw?.rsgKeys ?? [];

  let professorIds: Id<"professors">[] = [];
  const professorExternalIds = raw?.professorExternalIds;
  if (professorExternalIds && professorExternalIds.length > 0) {
    const resolved = await asyncMap(professorExternalIds, (extId) =>
      getOneFrom(ctx.db, "professors", "by_externalId", extId)
    );
    professorIds = resolved
      .filter((prof): prof is NonNullable<typeof prof> => !!prof)
      .map((prof) => prof._id);
  }

  const rsgCourseCodeSet = new Set<string>();
  if (rsgKeys.length > 0) {
    const entries = await asyncMap(rsgKeys, (key) =>
      getOneFrom(ctx.db, "rsg", "by_key", key)
    );
    for (const entry of entries) {
      if (!entry) {
        continue;
      }
      for (const courseCode of entry.courseCodes) {
        rsgCourseCodeSet.add(courseCode);
      }
    }
  }

  return {
    courseCode: args.courseCode?.trim()
      ? normalizeCourseCode(args.courseCode)
      : "",
    rsgCourseCodes: [...rsgCourseCodeSet],
    searchQuery: args.searchQuery?.trim() ?? "",
    departmentPrefixes: raw?.departmentPrefixes ?? [],
    termCodes: raw?.termCodes ?? [],
    professorIds,
    days: raw?.days ?? [],
    academicLevels: [...new Set(raw?.academicLevels ?? [])].sort(
      (a, b) => a - b
    ),
    timeRange: normalizeTimeRange(raw?.timeStart, raw?.timeEnd),
  };
}

function hasAnyActiveFilter(filters: ResolvedFilters): boolean {
  return (
    filters.courseCode.length > 0 ||
    filters.rsgCourseCodes.length > 0 ||
    filters.searchQuery.length > 0 ||
    filters.departmentPrefixes.length > 0 ||
    filters.termCodes.length > 0 ||
    filters.professorIds.length > 0 ||
    filters.days.length > 0 ||
    filters.academicLevels.length > 0 ||
    filters.timeRange !== null
  );
}

async function collectCourses(
  ctx: QueryCtx,
  filters: ResolvedFilters
): Promise<CourseDoc[]> {
  if (filters.courseCode) {
    return await collectByCourseCodes(ctx, [filters.courseCode]);
  }

  // Strategy 1: RSG keys — resolve to course codes and short-circuit all other strategies
  if (filters.rsgCourseCodes.length > 0) {
    return await collectByCourseCodes(ctx, filters.rsgCourseCodes);
  }

  // Strategy 2: Full-text search
  if (filters.searchQuery) {
    return await collectViaSearch(ctx, filters);
  }

  // Strategy 3: Department(s) — use by_departmentPrefix index
  if (filters.departmentPrefixes.length > 0) {
    return await collectByDepartment(ctx, filters.departmentPrefixes);
  }

  // Strategy 4: Professor(s) — use courseProfessors junction table
  if (filters.professorIds.length > 0) {
    return await collectByProfessor(ctx, filters.professorIds);
  }

  // Strategy 5: Academic level(s)
  if (filters.academicLevels.length > 0) {
    return await collectByAcademicLevel(ctx, filters.academicLevels);
  }

  // Strategy 6: Fallback — full scan (only post filters active)
  return await ctx.db.query("courses").withIndex("by_code").collect();
}

async function collectByCourseCodes(
  ctx: QueryCtx,
  courseCodes: string[]
): Promise<CourseDoc[]> {
  const courses = await asyncMap(courseCodes, (courseCode) =>
    getOneFrom(ctx.db, "courses", "by_code", courseCode)
  );
  return courses.filter(
    (course): course is NonNullable<typeof course> => !!course
  );
}

async function collectViaSearch(
  ctx: QueryCtx,
  filters: ResolvedFilters
): Promise<CourseDoc[]> {
  const { searchQuery, departmentPrefixes } = filters;
  const singleDept =
    departmentPrefixes.length === 1 ? departmentPrefixes[0] : undefined;

  let results = await ctx.db
    .query("courses")
    .withSearchIndex("search_courses", (q) => {
      const s = q.search("searchText", searchQuery);
      return singleDept ? s.eq("departmentPrefix", singleDept) : s;
    })
    .take(5000);

  // Multi-department filter in JS (search index only supports single .eq())
  if (departmentPrefixes.length > 1) {
    const deptSet = new Set(departmentPrefixes);
    results = results.filter((c) => deptSet.has(c.departmentPrefix));
  }

  return results;
}

async function collectUnfiltered(
  ctx: QueryCtx,
  pagination: { page: number; pageSize: number }
): Promise<{ courses: CourseDoc[]; totalCount: number }> {
  const start = (pagination.page - 1) * pagination.pageSize;

  const [stats, collected] = await Promise.all([
    ctx.db
      .query("courseStats")
      .withIndex("by_key", (q) => q.eq("key", "total"))
      .first(),
    ctx.db
      .query("courses")
      .withIndex("by_code")
      .take(start + pagination.pageSize),
  ]);

  if (!stats) {
    throw new ConvexError("No course stats found");
  }

  return {
    courses: collected.slice(start, start + pagination.pageSize),
    totalCount: stats.courseCount,
  };
}

async function collectByDepartment(
  ctx: QueryCtx,
  departmentPrefixes: string[]
): Promise<CourseDoc[]> {
  const perDept = await asyncMap(departmentPrefixes, (prefix) =>
    getManyFrom(ctx.db, "courses", "by_departmentPrefix", prefix)
  );

  return perDept.flat().sort((a, b) => a.code.localeCompare(b.code));
}

async function collectByAcademicLevel(
  ctx: QueryCtx,
  academicLevels: number[]
): Promise<CourseDoc[]> {
  const perLevel = await asyncMap(academicLevels, (academicLevel) =>
    getManyFrom(ctx.db, "courses", "by_academicLevel", academicLevel)
  );
  return perLevel.flat().sort((a, b) => a.code.localeCompare(b.code));
}

async function collectByProfessor(
  ctx: QueryCtx,
  professorIds: Id<"professors">[]
): Promise<CourseDoc[]> {
  const courseIdSet = new Set<string>();
  const courseDocs: CourseDoc[] = [];

  await asyncMap(professorIds, async (profId) => {
    const courses = await getManyVia(
      ctx.db,
      "courseProfessors",
      "courseId",
      "by_professorId",
      profId
    );

    for (const course of courses) {
      if (course && !courseIdSet.has(course._id)) {
        courseIdSet.add(course._id);
        courseDocs.push(course);
      }
    }
  });

  courseDocs.sort((a, b) => a.code.localeCompare(b.code));
  return courseDocs;
}

function hasActiveSectionFilters(filters: ResolvedFilters): boolean {
  return (
    filters.termCodes.length > 0 ||
    filters.professorIds.length > 0 ||
    filters.days.length > 0 ||
    filters.timeRange !== null
  );
}

async function collectCourseIdsByTimeRange(
  ctx: QueryCtx,
  filters: ResolvedFilters
): Promise<Set<Id<"courses">> | null> {
  const timeRange = filters.timeRange;
  if (!timeRange) {
    return null;
  }

  const sectionDocs =
    filters.termCodes.length > 0
      ? (
          await asyncMap(filters.termCodes, (termCode) =>
            ctx.db
              .query("sections")
              .withIndex("by_termCode_and_classStartMin", (q) =>
                q.eq("termCode", termCode).lt("classStartMin", timeRange.end)
              )
              .collect()
          )
        ).flat()
      : await ctx.db
          .query("sections")
          .withIndex("by_classStartMin", (q) =>
            q.lt("classStartMin", timeRange.end)
          )
          .collect();

  const courseIdSet = new Set<Id<"courses">>();
  for (const section of sectionDocs) {
    if (
      typeof section.classStartMin !== "number" ||
      typeof section.classEndMin !== "number"
    ) {
      continue;
    }
    const overlaps =
      section.classStartMin < timeRange.end &&
      section.classEndMin > timeRange.start;
    if (overlaps) {
      courseIdSet.add(section.courseId);
    }
  }

  return courseIdSet;
}

async function applyCourseFilters(
  ctx: QueryCtx,
  courses: CourseDoc[],
  filters: ResolvedFilters
): Promise<CourseDoc[]> {
  if (courses.length === 0) {
    return courses;
  }

  const academicLevelSet =
    filters.academicLevels.length > 0 ? new Set(filters.academicLevels) : null;
  const departmentPrefixSet =
    filters.departmentPrefixes.length > 0
      ? new Set(filters.departmentPrefixes)
      : null;
  const hasSectionFilters = hasActiveSectionFilters(filters);
  const termSet =
    hasSectionFilters && filters.termCodes.length > 0
      ? new Set(filters.termCodes)
      : null;
  const profSet =
    hasSectionFilters && filters.professorIds.length > 0
      ? new Set(filters.professorIds)
      : null;
  const daySet =
    hasSectionFilters && filters.days.length > 0 ? new Set(filters.days) : null;
  const timeCourseIdSet = hasSectionFilters
    ? await collectCourseIdsByTimeRange(ctx, filters)
    : null;

  return courses
    .filter((course) => {
      if (
        departmentPrefixSet &&
        !departmentPrefixSet.has(course.departmentPrefix)
      ) {
        return false;
      }
      if (termSet && !course.sectionTermCodes?.some((tc) => termSet.has(tc))) {
        return false;
      }
      if (
        profSet &&
        !course.sectionProfessorIds?.some((pid) => profSet.has(pid))
      ) {
        return false;
      }
      if (daySet && !course.sectionDays?.some((d) => daySet.has(d))) {
        return false;
      }
      if (academicLevelSet && !academicLevelSet.has(course.academicLevel)) {
        return false;
      }
      if (timeCourseIdSet && !timeCourseIdSet.has(course._id)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

function sectionMatchesFilters(
  section: SectionDoc,
  filters: ResolvedFilters,
  sets: {
    termSet: Set<string> | null;
    profSet: Set<Id<"professors">> | null;
    daySet: Set<number> | null;
  }
) {
  if (sets.termSet && !sets.termSet.has(section.termCode)) {
    return false;
  }

  if (
    sets.profSet &&
    !(section.professorId && sets.profSet.has(section.professorId))
  ) {
    return false;
  }

  const daySet = sets.daySet;
  if (daySet && !section.days.some((day) => daySet.has(day))) {
    return false;
  }

  if (filters.timeRange) {
    if (
      typeof section.classStartMin !== "number" ||
      typeof section.classEndMin !== "number"
    ) {
      return false;
    }

    const overlaps =
      section.classStartMin < filters.timeRange.end &&
      section.classEndMin > filters.timeRange.start;

    if (!overlaps) {
      return false;
    }
  }

  return true;
}

async function attachMatchingSections(
  ctx: QueryCtx,
  courses: CourseDoc[],
  filters: ResolvedFilters
): Promise<CourseWithSections[]> {
  if (courses.length === 0) {
    return [];
  }

  const termSet =
    filters.termCodes.length > 0 ? new Set(filters.termCodes) : null;
  const profSet =
    filters.professorIds.length > 0 ? new Set(filters.professorIds) : null;
  const daySet = filters.days.length > 0 ? new Set(filters.days) : null;
  const hasSectionFilters = hasActiveSectionFilters(filters);

  const matches = await asyncMap(courses, async (course) => {
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
      .collect();

    const matchingSections = hasSectionFilters
      ? sections.filter((section) =>
          sectionMatchesFilters(section, filters, { termSet, profSet, daySet })
        )
      : sections;

    if (hasSectionFilters && matchingSections.length === 0) {
      return null;
    }

    return {
      course,
      sections: matchingSections.sort((a, b) =>
        a.sectionCode.localeCompare(b.sectionCode)
      ),
    };
  });

  return matches.filter((match): match is NonNullable<typeof match> => !!match);
}

function paginate<T>(
  items: T[],
  pagination: { page: number; pageSize: number }
): T[] {
  const start = (pagination.page - 1) * pagination.pageSize;
  return items.slice(start, start + pagination.pageSize);
}

async function enrichWithSections(
  ctx: QueryCtx,
  courses: CourseWithSections[]
) {
  const requisiteCodes = new Set<string>();
  for (const { course } of courses) {
    for (const requisite of course.requisites ?? []) {
      for (const code of requisite.codes) {
        requisiteCodes.add(normalizeCourseCode(code));
      }
    }
  }

  const requisiteCourseEntries = await asyncMap(
    [...requisiteCodes],
    async (code): Promise<[string, Doc<"courses"> | null]> => [
      code,
      await getOneFrom(ctx.db, "courses", "by_code", code),
    ]
  );
  const requisiteCourseByCode = new Map<string, Doc<"courses"> | null>(
    requisiteCourseEntries
  );

  return await asyncMap(courses, async ({ course, sections }) => {
    const sectionProfessorIds = Array.from(
      new Set(
        sections
          .map((section) => section.professorId)
          .filter((id): id is NonNullable<typeof id> => !!id)
      )
    );

    const professors = await asyncMap(sectionProfessorIds, (professorId) =>
      ctx.db.get(professorId)
    );

    const professorById = new Map(
      professors
        .filter(
          (professor): professor is NonNullable<typeof professor> => !!professor
        )
        .map((professor) => [professor._id, professor])
    );

    const requisites = (course.requisites ?? [])
      .map((requisite) => {
        const text = combineRequisiteText(
          requisite.displayText,
          requisite.displayTextExtension
        );
        const annotatedText = combineRequisiteText(
          requisite.displayTextAnnotated,
          requisite.displayTextExtensionAnnotated ??
            requisite.displayTextExtension
        );

        return {
          text,
          annotatedText,
          linkedCourses: requisite.codes.map((code) => {
            const normalizedCode = normalizeCourseCode(code);
            const linkedCourse = requisiteCourseByCode.get(normalizedCode);

            return {
              normalizedCode,
              code: linkedCourse?.code ?? code,
              title: linkedCourse?.title ?? null,
              description: linkedCourse?.description ?? null,
            };
          }),
        };
      })
      .filter((requisite) => requisite.text.length > 0);

    return {
      id: course.externalId,
      code: course.code,
      title: course.title,
      description: course.description,
      credits: course.credits,
      isLab: course.isLab,
      avgQuality: course.avgQuality,
      avgDifficulty: course.avgDifficulty,
      ratingCount: course.ratingCount,
      requisites,
      sections: sections
        .map((section) => {
          const professor = section.professorId
            ? professorById.get(section.professorId)
            : null;
          return {
            _id: section._id,
            id: section.externalId,
            termCode: section.termCode,
            sectionCode: section.sectionCode,
            professorName:
              professor?.name ??
              (section.instructorTBD ? "TBD" : "Unknown Instructor"),
            professorImageUrl: professor?.imageUrl,
            professorAvgQuality: professor?.avgQuality ?? null,
            classStartTime: section.classStartTime,
            classEndTime: section.classEndTime,
            buildingName: section.buildingName,
            roomNumber: section.roomNumber,
            days: section.days,
            instructorTBD: section.instructorTBD,
            isOnline: section.isOnline,
          };
        })
        .sort((a, b) => a.sectionCode.localeCompare(b.sectionCode)),
    };
  });
}

export const listForExplore = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
    courseCode: v.optional(v.string()),
    courseExternalIds: v.optional(v.array(v.string())),
    filters: v.optional(
      v.object({
        rsgKeys: v.optional(v.array(v.string())),
        termCodes: v.optional(v.array(v.string())),
        departmentPrefixes: v.optional(v.array(v.string())),
        professorExternalIds: v.optional(v.array(v.string())),
        days: v.optional(v.array(v.number())),
        academicLevels: v.optional(v.array(v.number())),
        timeStart: v.optional(v.number()),
        timeEnd: v.optional(v.number()),
      })
    ),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paginationOptions = {
      page: args.page,
      pageSize: args.pageSize,
    };
    const filters = await resolveFilters(ctx, args);

    if (!hasAnyActiveFilter(filters)) {
      const { courses, totalCount } = await collectUnfiltered(
        ctx,
        paginationOptions
      );
      const page = await enrichWithSections(
        ctx,
        await attachMatchingSections(ctx, courses, filters)
      );
      return { page, totalCount };
    }

    const courses = await collectCourses(ctx, filters);
    const filteredCourses = await applyCourseFilters(ctx, courses, filters);
    const coursesWithSections = await attachMatchingSections(
      ctx,
      filteredCourses,
      filters
    );
    const totalCount = coursesWithSections.length;
    const pageCourses = paginate(coursesWithSections, paginationOptions);
    const page = await enrichWithSections(ctx, pageCourses);

    return {
      page,
      totalCount,
    };
  },
});
