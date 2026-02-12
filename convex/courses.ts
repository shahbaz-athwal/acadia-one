import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
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

export const listForExplore = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
    filters: v.optional(filtersValidator),
  },
  handler: async (ctx, args) => {
    const filters = args.filters;
    const departmentPrefixes = filters?.departmentPrefixes;
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

    // Build course query — use DB-level filter for department (scalar field)
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

    const allCourses = await coursesQuery.collect();

    // Apply section-level filters in JS using denormalized fields
    const hasSectionFilters =
      (termCodes && termCodes.length > 0) ||
      (professorIds && professorIds.length > 0) ||
      (daysFilter && daysFilter.length > 0);

    const allMatching = hasSectionFilters
      ? allCourses.filter((course) =>
          matchesDenormalizedFilters(course, {
            termCodes,
            professorIds,
            days: daysFilter,
          })
        )
      : allCourses;

    const totalCount = allMatching.length;

    // Manual offset pagination
    const start = (args.page - 1) * args.pageSize;
    const pageCourses = allMatching.slice(start, start + args.pageSize);

    // Fetch sections + professors only for courses on this page (for display)
    const page = await Promise.all(
      pageCourses.map(async (course) => {
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

    return { page, totalCount };
  },
});
