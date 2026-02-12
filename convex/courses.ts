import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";

const filtersValidator = v.object({
  termCodes: v.optional(v.array(v.string())),
  departmentPrefixes: v.optional(v.array(v.string())),
  professorExternalIds: v.optional(v.array(v.string())),
  days: v.optional(v.array(v.number())),
});

/**
 * Checks whether a course matches the given section-level filters
 * using the denormalized fields on the course document.
 */
function matchesDenormalizedFilters(
  course: Doc<"courses">,
  opts: {
    termCodes?: string[];
    professorIds?: string[];
    days?: number[];
  }
): boolean {
  const { termCodes, professorIds, days } = opts;

  if (termCodes?.length) {
    const hasTermMatch = course.sectionTermCodes?.some((tc) =>
      termCodes.includes(tc)
    );
    if (!hasTermMatch) {
      return false;
    }
  }
  if (professorIds?.length) {
    const hasProfMatch = course.sectionProfessorIds?.some((pid) =>
      professorIds.includes(pid as never)
    );
    if (!hasProfMatch) {
      return false;
    }
  }
  if (days?.length) {
    const hasDayMatch = course.sectionDays?.some((d) => days.includes(d));
    if (!hasDayMatch) {
      return false;
    }
  }
  return true;
}

/**
 * Fetches sections + professors for the given courses and returns
 * display-ready objects.
 */
async function enrichCoursesWithSections(
  ctx: QueryCtx,
  courses: Doc<"courses">[]
) {
  return await Promise.all(
    courses.map(async (course) => {
      const sections = await ctx.db
        .query("sections")
        .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
        .collect();

      const sectionProfessorIds = Array.from(
        new Set(
          sections
            .map((section) => section.professorId)
            .filter((id): id is NonNullable<typeof id> => !!id)
        )
      );
      const professors = await Promise.all(
        sectionProfessorIds.map((professorId) => ctx.db.get(professorId))
      );
      const professorById = new Map(
        professors
          .filter(
            (professor): professor is NonNullable<typeof professor> =>
              !!professor
          )
          .map((professor) => [professor._id, professor])
      );

      const requisites = (course.requisites ?? [])
        .map((requisite) => {
          const extension = requisite.displayTextExtension.trim();
          return extension
            ? `${requisite.displayText} ${extension}`.trim()
            : requisite.displayText;
        })
        .filter((value) => value.length > 0);

      return {
        id: course.externalId,
        code: course.code,
        title: course.title,
        credits: course.credits,
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
              id: section.externalId,
              termCode: section.termCode,
              sectionCode: section.sectionCode,
              professorName:
                professor?.name ??
                (section.instructorTBD ? "TBD" : "Unknown Instructor"),
              professorImageUrl: professor?.imageUrl,
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
    })
  );
}

interface PostScanOpts {
  termCodes?: string[];
  professorIds?: string[];
  days?: number[];
}

function applyPostScanFilters(
  courses: Doc<"courses">[],
  hasPostScanFilters: boolean,
  opts: PostScanOpts
): Doc<"courses">[] {
  if (!hasPostScanFilters) {
    return courses;
  }
  return courses.filter((course) => matchesDenormalizedFilters(course, opts));
}

/**
 * Collects courses using the full text search index, then filters by
 * department and post-scan criteria in JS.
 */
async function collectViaSearch(
  ctx: QueryCtx,
  searchQuery: string,
  departmentPrefixes: string[]
): Promise<Doc<"courses">[]> {
  const singleDept =
    departmentPrefixes.length === 1 ? departmentPrefixes[0] : undefined;

  let collected = await ctx.db
    .query("courses")
    .withSearchIndex("search_courses", (q) => {
      const s = q.search("searchText", searchQuery);
      return singleDept ? s.eq("departmentPrefix", singleDept) : s;
    })
    .take(256);

  // Multi-department filter in JS (search index only supports single .eq())
  if (departmentPrefixes.length > 1) {
    collected = collected.filter((c) =>
      departmentPrefixes.includes(c.departmentPrefix)
    );
  }

  return collected;
}

/**
 * Collects courses using database indexes (no search query).
 * Returns { pageCourses, totalCount } directly when possible (Path A),
 * or a collected array to be post-filtered (Paths B/C/D).
 */
async function collectViaIndex(
  ctx: QueryCtx,
  departmentPrefixes: string[],
  hasPostScanFilters: boolean,
  start: number,
  pageSize: number
): Promise<
  | { kind: "direct"; pageCourses: Doc<"courses">[]; totalCount: number }
  | { kind: "collected"; courses: Doc<"courses">[] }
> {
  if (departmentPrefixes.length === 0 && !hasPostScanFilters) {
    // ── Path A: No filters at all ──
    const stats = await ctx.db
      .query("courseStats")
      .withIndex("by_key", (q) => q.eq("key", "total"))
      .first();

    if (!stats) {
      throw new ConvexError("No course stats found");
    }

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_code")
      .take(start + pageSize);
    return {
      kind: "direct",
      pageCourses: courses.slice(start),
      totalCount: stats.courseCount,
    };
  }

  // ── Paths B/C/D: At least one filter is active ──
  if (departmentPrefixes.length === 1) {
    // Path B: Single department
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_departmentPrefix", (q) =>
        q.eq("departmentPrefix", departmentPrefixes[0])
      )
      .collect();
    return { kind: "collected", courses };
  }

  if (departmentPrefixes.length > 1) {
    // Path C: Multiple departments — parallel queries, merge + sort
    const perDept = await Promise.all(
      departmentPrefixes.map((p) =>
        ctx.db
          .query("courses")
          .withIndex("by_departmentPrefix", (q) => q.eq("departmentPrefix", p))
          .collect()
      )
    );
    return {
      kind: "collected",
      courses: perDept.flat().sort((a, b) => a.code.localeCompare(b.code)),
    };
  }

  // Path D: No department filter + post-scan filters only
  const courses = await ctx.db.query("courses").withIndex("by_code").collect();
  return { kind: "collected", courses };
}

export const listForExplore = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
    filters: v.optional(filtersValidator),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const filters = args.filters;
    const departmentPrefixes = filters?.departmentPrefixes ?? [];
    const termCodes = filters?.termCodes;
    const professorExternalIds = filters?.professorExternalIds;
    const daysFilter = filters?.days;

    // Resolve professor externalIds to Convex _ids (once per query)
    let professorIds: string[] | undefined;
    if (professorExternalIds && professorExternalIds.length > 0) {
      const resolved = await Promise.all(
        professorExternalIds.map((extId) =>
          ctx.db
            .query("professors")
            .withIndex("by_externalId", (q) => q.eq("externalId", extId))
            .first()
        )
      );
      professorIds = resolved
        .filter((prof): prof is NonNullable<typeof prof> => !!prof)
        .map((prof) => prof._id);
    }

    const start = (args.page - 1) * args.pageSize;
    const postScanOpts: PostScanOpts = {
      termCodes,
      professorIds,
      days: daysFilter,
    };
    const hasPostScanFilters =
      (termCodes && termCodes.length > 0) ||
      (professorIds && professorIds.length > 0) ||
      (daysFilter && daysFilter.length > 0);

    const searchQuery = args.searchQuery?.trim() || "";

    // ── Search path: full text search index ──
    if (searchQuery) {
      const collected = await collectViaSearch(
        ctx,
        searchQuery,
        departmentPrefixes
      );
      const allMatching = applyPostScanFilters(
        collected,
        !!hasPostScanFilters,
        postScanOpts
      );
      const pageCourses = allMatching.slice(start, start + args.pageSize);
      const page = await enrichCoursesWithSections(ctx, pageCourses);
      return { page, totalCount: allMatching.length };
    }

    // ── Index path ──
    const result = await collectViaIndex(
      ctx,
      departmentPrefixes,
      !!hasPostScanFilters,
      start,
      args.pageSize
    );

    if (result.kind === "direct") {
      const page = await enrichCoursesWithSections(ctx, result.pageCourses);
      return { page, totalCount: result.totalCount };
    }

    const allMatching = applyPostScanFilters(
      result.courses,
      !!hasPostScanFilters,
      postScanOpts
    );
    const pageCourses = allMatching.slice(start, start + args.pageSize);
    const page = await enrichCoursesWithSections(ctx, pageCourses);
    return { page, totalCount: allMatching.length };
  },
});
