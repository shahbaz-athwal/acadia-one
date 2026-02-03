import { v } from "convex/values";
import { query } from "./_generated/server";

const courseFiltersValidator = v.object({
  search: v.optional(v.string()),
  professorIds: v.optional(v.array(v.string())),
  termCodes: v.optional(v.array(v.string())),
  timeRange: v.optional(
    v.object({
      start: v.string(),
      end: v.string(),
    })
  ),
  departmentPrefixes: v.optional(v.array(v.string())),
  academicLevels: v.optional(v.array(v.number())),
});

const courseSortValidator = v.object({
  key: v.union(
    v.literal("title"),
    v.literal("difficulty"),
    v.literal("numRatings"),
    v.literal("courseLevel")
  ),
  dir: v.union(v.literal("asc"), v.literal("desc")),
});

const paginationValidator = v.object({
  cursor: v.optional(v.string()),
  limit: v.number(),
});

function extractAcademicLevel(code: string): number {
  const match = code.match(/[A-Z]+(\d)/);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;
  const hour = Number.parseInt(match[1] ?? "0", 10);
  const minute = Number.parseInt(match[2] ?? "0", 10);
  const period = match[3]?.toUpperCase();
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (!period) {
    return hour * 60 + minute;
  }
  const normalizedHour = hour % 12;
  const offset = period === "PM" ? 12 : 0;
  return (normalizedHour + offset) * 60 + minute;
}

export const list = query({
  args: {
    filters: v.optional(courseFiltersValidator),
    sort: v.optional(courseSortValidator),
    pagination: paginationValidator,
  },
  returns: v.object({
    courses: v.array(
      v.object({
        id: v.string(),
        code: v.string(),
        title: v.string(),
        description: v.string(),
        departmentPrefix: v.string(),
        credits: v.number(),
        _computed: v.object({
          academicLevel: v.number(),
          avgDifficulty: v.union(v.number(), v.null()),
          ratingCount: v.number(),
        }),
      })
    ),
    nextCursor: v.union(v.string(), v.null()),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { filters, sort, pagination } = args;
    const limit = pagination.limit;
    const offset = pagination.cursor
      ? Number.parseInt(pagination.cursor, 10)
      : 0;

    let courses = await ctx.db.query("courses").collect();

    if (filters?.departmentPrefixes?.length) {
      const byDepartments: typeof courses = [];
      for (const prefix of filters.departmentPrefixes) {
        const matches = await ctx.db
          .query("courses")
          .withIndex("by_departmentPrefix", (q) =>
            q.eq("departmentPrefix", prefix)
          )
          .collect();
        byDepartments.push(...matches);
      }
      const unique = new Map(
        byDepartments.map((course) => [course._id, course])
      );
      courses = Array.from(unique.values());
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      courses = courses.filter(
        (course) =>
          course.title.toLowerCase().includes(search) ||
          course.code.toLowerCase().includes(search)
      );
    }

    if (filters?.professorIds?.length) {
      const courseIdSet = new Set<string>();
      for (const professorExternalId of filters.professorIds) {
        const links = await ctx.db
          .query("courseProfessors")
          .withIndex("by_professorExternalId", (q) =>
            q.eq("professorExternalId", professorExternalId)
          )
          .collect();
        links.forEach((link) => courseIdSet.add(link.courseId));
      }
      courses = courses.filter((course) => courseIdSet.has(course._id));
    }

    if (filters?.termCodes?.length) {
      const courseIdSet = new Set<string>();
      for (const termCode of filters.termCodes) {
        const sections = await ctx.db
          .query("sections")
          .withIndex("by_termCode", (q) => q.eq("termCode", termCode))
          .collect();
        sections.forEach((section) => courseIdSet.add(section.courseId));
      }
      courses = courses.filter((course) => courseIdSet.has(course._id));
    }

    if (filters?.timeRange) {
      const startMinutes = parseTimeToMinutes(filters.timeRange.start);
      const endMinutes = parseTimeToMinutes(filters.timeRange.end);
      if (startMinutes !== null && endMinutes !== null) {
        const courseIdSet = new Set<string>();
        const sections = await ctx.db.query("sections").collect();
        for (const section of sections) {
          const sectionStart = parseTimeToMinutes(section.classStartTime);
          const sectionEnd = parseTimeToMinutes(section.classEndTime);
          if (
            sectionStart !== null &&
            sectionEnd !== null &&
            sectionStart >= startMinutes &&
            sectionEnd <= endMinutes
          ) {
            courseIdSet.add(section.courseId);
          }
        }
        courses = courses.filter((course) => courseIdSet.has(course._id));
      }
    }

    if (filters?.academicLevels?.length) {
      courses = courses.filter((course) =>
        filters.academicLevels?.includes(extractAcademicLevel(course.code))
      );
    }

    const direction = sort?.dir === "desc" ? -1 : 1;
    const sortKey = sort?.key ?? "title";
    courses.sort((a, b) => {
      if (sortKey === "difficulty") {
        const aVal = a.avgDifficulty ?? -1;
        const bVal = b.avgDifficulty ?? -1;
        return (aVal - bVal) * direction;
      }
      if (sortKey === "numRatings") {
        return (a.ratingCount - b.ratingCount) * direction;
      }
      if (sortKey === "courseLevel") {
        return (
          (extractAcademicLevel(a.code) - extractAcademicLevel(b.code)) *
          direction
        );
      }
      return a.title.localeCompare(b.title) * direction;
    });

    const totalCount = courses.length;
    const sliced = courses.slice(offset, offset + limit + 1);
    const hasMore = sliced.length > limit;
    const nextCursor = hasMore ? String(offset + limit) : null;

    return {
      courses: (hasMore ? sliced.slice(0, limit) : sliced).map((course) => ({
        id: course.externalId,
        code: course.code,
        title: course.title,
        description: course.description,
        departmentPrefix: course.departmentPrefix,
        credits: course.credits,
        _computed: {
          academicLevel: extractAcademicLevel(course.code),
          avgDifficulty: course.avgDifficulty,
          ratingCount: course.ratingCount,
        },
      })),
      nextCursor,
      totalCount,
    };
  },
});

export const byCode = query({
  args: { code: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      metadata: v.object({
        id: v.string(),
        code: v.string(),
        title: v.string(),
        description: v.string(),
        credits: v.number(),
        departmentPrefix: v.string(),
        departmentName: v.optional(v.string()),
        requisites: v.optional(
          v.array(
            v.object({
              code: v.string(),
              displayText: v.string(),
              displayTextExtension: v.string(),
            })
          )
        ),
        lastSectionPulledAt: v.optional(v.number()),
      }),
      sectionsByTerm: v.array(
        v.object({
          term: v.object({
            code: v.string(),
            name: v.string(),
            isActive: v.boolean(),
            startDate: v.number(),
            endDate: v.number(),
          }),
          sections: v.array(
            v.object({
              id: v.string(),
              termCode: v.string(),
              sectionCode: v.string(),
              sectionSearchName: v.string(),
              classStartTime: v.string(),
              classEndTime: v.string(),
              buildingName: v.string(),
              roomNumber: v.string(),
              days: v.array(v.number()),
              professorId: v.optional(v.string()),
              instructorTBD: v.boolean(),
              isOnline: v.boolean(),
            })
          ),
        })
      ),
      professors: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          designation: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
          departmentPrefix: v.string(),
          sectionCountForCourse: v.number(),
        })
      ),
      ratings: v.array(
        v.object({
          id: v.string(),
          professorId: v.string(),
          professorName: v.string(),
          professorImageUrl: v.optional(v.string()),
          quality: v.number(),
          difficulty: v.number(),
          comment: v.optional(v.string()),
          postedAt: v.number(),
          tags: v.array(v.string()),
          wouldTakeAgain: v.optional(v.boolean()),
          isForCredit: v.optional(v.boolean()),
          textBookRequired: v.optional(v.boolean()),
          attendanceRequired: v.boolean(),
          gradeReceived: v.optional(v.string()),
          thumbsUpTotal: v.number(),
          thumbsDownTotal: v.number(),
          flagCount: v.optional(v.number()),
        })
      ),
      files: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          key: v.string(),
          mimeType: v.string(),
          size: v.number(),
          createdAt: v.number(),
          userId: v.string(),
        })
      ),
      _aggregates: v.object({
        totalRatings: v.number(),
        avgDifficulty: v.union(v.number(), v.null()),
        avgQuality: v.union(v.number(), v.null()),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const course = await ctx.db
      .query("courses")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    if (!course) return null;

    const department = await ctx.db
      .query("departments")
      .withIndex("by_prefix", (q) => q.eq("prefix", course.departmentPrefix))
      .first();

    const sections = await ctx.db
      .query("sections")
      .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
      .collect();

    const termCodes = Array.from(new Set(sections.map((s) => s.termCode)));
    const terms = (
      await Promise.all(
        termCodes.map((code) =>
          ctx.db
            .query("terms")
            .withIndex("by_code", (q) => q.eq("code", code))
            .first()
        )
      )
    ).filter((term): term is NonNullable<typeof term> => !!term);
    const termMap = new Map(terms.map((term) => [term.code, term]));

    const sectionsByTermMap = new Map<
      string,
      { term: (typeof terms)[number]; sections: typeof sections }
    >();

    for (const section of sections) {
      const term = termMap.get(section.termCode);
      if (!term) continue;
      if (!sectionsByTermMap.has(section.termCode)) {
        sectionsByTermMap.set(section.termCode, { term, sections: [] });
      }
      sectionsByTermMap.get(section.termCode)?.sections.push(section);
    }

    const sectionsByTerm = Array.from(sectionsByTermMap.values()).sort(
      (a, b) => {
        if (a.term.isActive !== b.term.isActive) {
          return a.term.isActive ? -1 : 1;
        }
        return b.term.startDate - a.term.startDate;
      }
    );

    const professorLinks = await ctx.db
      .query("courseProfessors")
      .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
      .collect();

    const professors = (
      await Promise.all(
        professorLinks.map((link) => ctx.db.get(link.professorId))
      )
    ).filter(
      (professor): professor is NonNullable<typeof professor> => !!professor
    );

    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
      .collect();
    const approvedRatings = ratings.filter(
      (rating) => rating.status === "APPROVED"
    );

    const professorById = new Map(
      professors.map((professor) => [professor._id, professor])
    );

    const ratingsResponse = approvedRatings
      .map((rating) => {
        const professor = professorById.get(rating.professorId);
        if (!professor) return null;
        return {
          id: rating._id,
          professorId: professor.externalId,
          professorName: professor.name,
          professorImageUrl: professor.imageUrl,
          quality: rating.quality,
          difficulty: rating.difficulty,
          comment: rating.comment,
          postedAt: rating.postedAt,
          tags: rating.tags,
          wouldTakeAgain: rating.wouldTakeAgain,
          isForCredit: rating.isForCredit,
          textBookRequired: rating.textBookRequired,
          attendanceRequired: rating.attendanceRequired,
          gradeReceived: rating.gradeReceived,
          thumbsUpTotal: rating.thumbsUpTotal,
          thumbsDownTotal: rating.thumbsDownTotal,
          flagCount: undefined,
        };
      })
      .filter((rating): rating is NonNullable<typeof rating> => !!rating);

    const professorsResponse = professors.map((professor) => {
      const sectionCountForCourse = sections.filter(
        (section) => section.professorId === professor._id
      ).length;
      return {
        id: professor.externalId,
        name: professor.name,
        designation: professor.designation,
        imageUrl: professor.imageUrl,
        departmentPrefix: professor.departmentPrefix,
        sectionCountForCourse,
      };
    });

    const totalRatings = approvedRatings.length;
    const avgDifficulty =
      totalRatings > 0
        ? approvedRatings.reduce((sum, rating) => sum + rating.difficulty, 0) /
          totalRatings
        : null;
    const avgQuality =
      totalRatings > 0
        ? approvedRatings.reduce((sum, rating) => sum + rating.quality, 0) /
          totalRatings
        : null;

    return {
      metadata: {
        id: course.externalId,
        code: course.code,
        title: course.title,
        description: course.description,
        credits: course.credits,
        departmentPrefix: course.departmentPrefix,
        departmentName: department?.name,
        requisites: course.requisites,
        lastSectionPulledAt: course.lastSectionPulledAt,
      },
      sectionsByTerm: sectionsByTerm.map((entry) => ({
        term: {
          code: entry.term.code,
          name: entry.term.name,
          isActive: entry.term.isActive,
          startDate: entry.term.startDate,
          endDate: entry.term.endDate,
        },
        sections: entry.sections.map((section) => ({
          id: section.externalId,
          termCode: section.termCode,
          sectionCode: section.sectionCode,
          sectionSearchName: section.sectionSearchName,
          classStartTime: section.classStartTime,
          classEndTime: section.classEndTime,
          buildingName: section.buildingName,
          roomNumber: section.roomNumber,
          days: section.days,
          professorId: section.professorId
            ? professorById.get(section.professorId)?.externalId
            : undefined,
          instructorTBD: section.instructorTBD,
          isOnline: section.isOnline,
        })),
      })),
      professors: professorsResponse,
      ratings: ratingsResponse,
      files: [],
      _aggregates: {
        totalRatings,
        avgDifficulty,
        avgQuality,
      },
    };
  },
});
