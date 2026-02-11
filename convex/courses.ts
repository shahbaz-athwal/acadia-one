import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

const filtersValidator = v.object({
  termCodes: v.optional(v.array(v.string())),
  departmentPrefixes: v.optional(v.array(v.string())),
  professorExternalIds: v.optional(v.array(v.string())),
  days: v.optional(v.array(v.number())),
});

function matchesSectionFilters(
  section: { termCode: string; professorId?: string; days: number[] },
  opts: {
    termCodes?: string[];
    professorIdSet?: Set<string>;
    days?: number[];
  }
): boolean {
  if (
    opts.termCodes &&
    opts.termCodes.length > 0 &&
    !opts.termCodes.includes(section.termCode)
  ) {
    return false;
  }
  if (opts.professorIdSet && !section.professorId) {
    return false;
  }
  if (
    opts.professorIdSet &&
    !opts.professorIdSet.has(section.professorId ?? "")
  ) {
    return false;
  }
  const daysFilter = opts.days;
  if (
    daysFilter &&
    daysFilter.length > 0 &&
    !section.days.some((day) => daysFilter.includes(day))
  ) {
    return false;
  }
  return true;
}

export const listForExplore = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filters: v.optional(filtersValidator),
  },
  handler: async (ctx, args) => {
    const filters = args.filters;
    const departmentPrefixes = filters?.departmentPrefixes;
    const termCodes = filters?.termCodes;
    const professorExternalIds = filters?.professorExternalIds;
    const daysFilter = filters?.days;

    // Phase 0: Resolve professor externalIds to Convex _ids (once per query)
    let professorIdSet: Set<string> | undefined;
    if (professorExternalIds && professorExternalIds.length > 0) {
      const resolved = await Promise.all(
        professorExternalIds.map((extId) =>
          ctx.db
            .query("professors")
            .withIndex("by_externalId", (q) => q.eq("externalId", extId))
            .first()
        )
      );
      professorIdSet = new Set(
        resolved
          .filter((prof): prof is NonNullable<typeof prof> => !!prof)
          .map((prof) => prof._id)
      );
    }

    // Phase 1: Course-level filtering (department) + pagination
    let coursesQuery = ctx.db.query("courses").withIndex("by_code");

    if (departmentPrefixes && departmentPrefixes.length > 0) {
      const prefixes = departmentPrefixes;
      coursesQuery = coursesQuery.filter((q) =>
        prefixes.length === 1
          ? q.eq(q.field("departmentPrefix"), prefixes[0])
          : q.or(
              ...prefixes.map((prefix) =>
                q.eq(q.field("departmentPrefix"), prefix)
              )
            )
      );
    }

    const paginatedCourses = await coursesQuery.paginate(args.paginationOpts);

    const hasSectionFilters =
      (termCodes && termCodes.length > 0) ||
      professorIdSet !== undefined ||
      (daysFilter && daysFilter.length > 0);

    // Phase 2: Fetch sections, apply section-level filters, build page
    const page = (
      await Promise.all(
        paginatedCourses.page.map(async (course) => {
          let sections = await ctx.db
            .query("sections")
            .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
            .collect();

          // Apply section-level filters
          if (hasSectionFilters) {
            sections = sections.filter((section) =>
              matchesSectionFilters(section, {
                termCodes,
                professorIdSet,
                days: daysFilter,
              })
            );

            // Exclude courses with no matching sections
            if (sections.length === 0) {
              return null;
            }
          }

          const professorIds = Array.from(
            new Set(
              sections
                .map((section) => section.professorId)
                .filter((id): id is NonNullable<typeof id> => !!id)
            )
          );
          const professors = await Promise.all(
            professorIds.map((professorId) => ctx.db.get(professorId))
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
      )
    ).filter((course): course is NonNullable<typeof course> => course !== null);

    return {
      ...paginatedCourses,
      page,
    };
  },
});

export const countForExplore = query({
  args: {
    filters: v.optional(filtersValidator),
  },
  handler: async (ctx, args) => {
    const filters = args.filters;
    const departmentPrefixes = filters?.departmentPrefixes;
    const termCodes = filters?.termCodes;
    const professorExternalIds = filters?.professorExternalIds;
    const daysFilter = filters?.days;

    // Resolve professor externalIds to Convex _ids
    let professorIdSet: Set<string> | undefined;
    if (professorExternalIds && professorExternalIds.length > 0) {
      const resolved = await Promise.all(
        professorExternalIds.map((extId) =>
          ctx.db
            .query("professors")
            .withIndex("by_externalId", (q) => q.eq("externalId", extId))
            .first()
        )
      );
      professorIdSet = new Set(
        resolved
          .filter((prof): prof is NonNullable<typeof prof> => !!prof)
          .map((prof) => prof._id)
      );
    }

    // Course-level filtering (department)
    let coursesQuery = ctx.db.query("courses");

    if (departmentPrefixes && departmentPrefixes.length > 0) {
      const prefixes = departmentPrefixes;
      coursesQuery = coursesQuery.filter((q) =>
        prefixes.length === 1
          ? q.eq(q.field("departmentPrefix"), prefixes[0])
          : q.or(
              ...prefixes.map((prefix) =>
                q.eq(q.field("departmentPrefix"), prefix)
              )
            )
      );
    }

    const courses = await coursesQuery.collect();

    const hasSectionFilters =
      (termCodes && termCodes.length > 0) ||
      professorIdSet !== undefined ||
      (daysFilter && daysFilter.length > 0);

    if (!hasSectionFilters) {
      return courses.length;
    }

    // For section-level filters, check each course for matching sections
    let count = 0;
    for (const course of courses) {
      const sections = await ctx.db
        .query("sections")
        .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
        .collect();

      const hasMatch = sections.some((section) =>
        matchesSectionFilters(section, {
          termCodes,
          professorIdSet,
          days: daysFilter,
        })
      );

      if (hasMatch) {
        count++;
      }
    }

    return count;
  },
});
