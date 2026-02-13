import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";

interface ResolvedFilters {
  searchQuery: string;
  departmentPrefixes: string[];
  termCodes: string[];
  professorIds: string[];
  days: number[];
}

const filtersValidator = v.object({
  termCodes: v.optional(v.array(v.string())),
  departmentPrefixes: v.optional(v.array(v.string())),
  professorExternalIds: v.optional(v.array(v.string())),
  days: v.optional(v.array(v.number())),
});

// ── 1. Filter Resolution ───────────────────────────────────────────────────────

/**
 * Normalizes raw query args into a canonical `ResolvedFilters` object.
 * Resolves professor externalIds to Convex _ids.
 */
async function resolveFilters(
  ctx: QueryCtx,
  args: {
    filters?: {
      termCodes?: string[];
      departmentPrefixes?: string[];
      professorExternalIds?: string[];
      days?: number[];
    };
    searchQuery?: string;
  }
): Promise<ResolvedFilters> {
  const raw = args.filters;

  let professorIds: string[] = [];
  const professorExternalIds = raw?.professorExternalIds;
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

  return {
    searchQuery: args.searchQuery?.trim() ?? "",
    departmentPrefixes: raw?.departmentPrefixes ?? [],
    termCodes: raw?.termCodes ?? [],
    professorIds,
    days: raw?.days ?? [],
  };
}

// ── 2. Course Collection ───────────────────────────────────────────────────────

/**
 * Collects candidate courses using the best available index strategy.
 *
 * Returns `{ courses, totalCount }` where `totalCount` is the known total
 * when available (unfiltered path), or `null` when it must be computed
 * after post-scan filtering.
 *
 * Strategy priority:
 *  1. Full-text search (when searchQuery is present)
 *  2. No filters — paginated scan via `by_code` + precomputed count
 *  3. Department filter — `by_departmentPrefix` index
 *  4. Professor filter — `courseProfessors` junction table
 *  5. Fallback — full scan via `by_code`
 */
async function collectCourses(
  ctx: QueryCtx,
  filters: ResolvedFilters,
  pagination: { page: number; pageSize: number }
): Promise<{ courses: Doc<"courses">[]; totalCount: number | null }> {
  // Strategy 1: Full-text search
  if (filters.searchQuery) {
    return {
      courses: await collectViaSearch(ctx, filters),
      totalCount: null,
    };
  }

  const hasAnyFilter =
    filters.departmentPrefixes.length > 0 ||
    filters.termCodes.length > 0 ||
    filters.professorIds.length > 0 ||
    filters.days.length > 0;

  // Strategy 2: No filters — use by_code index with take() + courseStats count
  if (!hasAnyFilter) {
    return await collectUnfiltered(ctx, pagination);
  }

  // Strategy 3: Department(s) — use by_departmentPrefix index
  if (filters.departmentPrefixes.length > 0) {
    return {
      courses: await collectByDepartment(ctx, filters.departmentPrefixes),
      totalCount: null,
    };
  }

  // Strategy 4: Professor(s) — use courseProfessors junction table
  if (filters.professorIds.length > 0) {
    return {
      courses: await collectByProfessor(ctx, filters.professorIds),
      totalCount: null,
    };
  }

  // Strategy 5: Fallback — full scan (only term/days filters active)
  const courses = await ctx.db.query("courses").withIndex("by_code").collect();
  return { courses, totalCount: null };
}

/** Uses the full-text search index, with optional single-department equality filter. */
async function collectViaSearch(
  ctx: QueryCtx,
  filters: ResolvedFilters
): Promise<Doc<"courses">[]> {
  const { searchQuery, departmentPrefixes } = filters;
  const singleDept =
    departmentPrefixes.length === 1 ? departmentPrefixes[0] : undefined;

  let results = await ctx.db
    .query("courses")
    .withSearchIndex("search_courses", (q) => {
      const s = q.search("searchText", searchQuery);
      return singleDept ? s.eq("departmentPrefix", singleDept) : s;
    })
    .take(256);

  // Multi-department filter in JS (search index only supports single .eq())
  if (departmentPrefixes.length > 1) {
    const deptSet = new Set(departmentPrefixes);
    results = results.filter((c) => deptSet.has(c.departmentPrefix));
  }

  return results;
}

/** No filters at all — paginated scan with precomputed total from courseStats. */
async function collectUnfiltered(
  ctx: QueryCtx,
  pagination: { page: number; pageSize: number }
): Promise<{ courses: Doc<"courses">[]; totalCount: number }> {
  const start = (pagination.page - 1) * pagination.pageSize;

  const [stats, courses] = await Promise.all([
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
    courses: courses.slice(start),
    totalCount: stats.courseCount,
  };
}

/** Single or multiple departments — parallel index queries, merged and sorted. */
async function collectByDepartment(
  ctx: QueryCtx,
  departmentPrefixes: string[]
): Promise<Doc<"courses">[]> {
  const perDept = await Promise.all(
    departmentPrefixes.map((prefix) =>
      ctx.db
        .query("courses")
        .withIndex("by_departmentPrefix", (q) =>
          q.eq("departmentPrefix", prefix)
        )
        .collect()
    )
  );

  if (departmentPrefixes.length === 1) {
    return perDept[0];
  }

  return perDept.flat().sort((a, b) => a.code.localeCompare(b.code));
}

/** Professor filter — uses courseProfessors junction table to find courses. */
async function collectByProfessor(
  ctx: QueryCtx,
  professorIds: string[]
): Promise<Doc<"courses">[]> {
  const courseIdSet = new Set<string>();
  const courseDocs: Doc<"courses">[] = [];

  await Promise.all(
    professorIds.map(async (profId) => {
      const links = await ctx.db
        .query("courseProfessors")
        .withIndex("by_professorId", (q) =>
          q.eq("professorId", profId as never)
        )
        .collect();

      const courses = await Promise.all(
        links.map((link) => ctx.db.get(link.courseId))
      );

      for (const course of courses) {
        if (course && !courseIdSet.has(course._id)) {
          courseIdSet.add(course._id);
          courseDocs.push(course);
        }
      }
    })
  );

  courseDocs.sort((a, b) => a.code.localeCompare(b.code));
  return courseDocs;
}

// ── 3. Post-scan Filtering ─────────────────────────────────────────────────────

/**
 * Filters courses in JS using denormalized section fields.
 * Only applied for filters that can't be handled at the index level
 * (term codes, professor IDs, days).
 */
function applyPostFilters(
  courses: Doc<"courses">[],
  filters: ResolvedFilters
): Doc<"courses">[] {
  const hasPostFilters =
    filters.termCodes.length > 0 ||
    filters.professorIds.length > 0 ||
    filters.days.length > 0;

  if (!hasPostFilters) {
    return courses;
  }

  // Build sets once for O(1) lookups during filtering
  const termSet =
    filters.termCodes.length > 0 ? new Set(filters.termCodes) : null;
  const profSet =
    filters.professorIds.length > 0 ? new Set(filters.professorIds) : null;
  const daySet = filters.days.length > 0 ? new Set(filters.days) : null;

  return courses.filter((course) => {
    if (termSet && !course.sectionTermCodes?.some((tc) => termSet.has(tc))) {
      return false;
    }
    if (
      profSet &&
      !course.sectionProfessorIds?.some((pid) => profSet.has(pid as string))
    ) {
      return false;
    }
    if (daySet && !course.sectionDays?.some((d) => daySet.has(d))) {
      return false;
    }
    return true;
  });
}

function paginate(
  courses: Doc<"courses">[],
  pagination: { page: number; pageSize: number }
): Doc<"courses">[] {
  const start = (pagination.page - 1) * pagination.pageSize;
  return courses.slice(start, start + pagination.pageSize);
}

async function enrichWithSections(ctx: QueryCtx, courses: Doc<"courses">[]) {
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

// ── Query ──────────────────────────────────────────────────────────────────────

export const listForExplore = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
    filters: v.optional(filtersValidator),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paginationOptions = {
      page: args.page,
      pageSize: args.pageSize,
    };
    const filters = await resolveFilters(ctx, args);
    const { courses, totalCount } = await collectCourses(
      ctx,
      filters,
      paginationOptions
    );
    const filtered = applyPostFilters(courses, filters);
    const pageCourses = paginate(filtered, paginationOptions);
    const page = await enrichWithSections(ctx, pageCourses);

    return {
      page,
      totalCount: totalCount ?? filtered.length,
    };
  },
});
