import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      departmentPrefix: v.string(),
      imageUrl: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const professors = await ctx.db.query("professors").collect();
    return professors
      .map((professor) => ({
        id: professor.externalId,
        name: professor.name,
        departmentPrefix: professor.departmentPrefix,
        imageUrl: professor.imageUrl,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const byId = query({
  args: { id: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      metadata: v.object({
        id: v.string(),
        rmpId: v.optional(v.string()),
        name: v.string(),
        designation: v.optional(v.string()),
        officeLocation: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        linkedinUrl: v.optional(v.string()),
        websiteUrl: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        lastPullFromRmp: v.optional(v.number()),
        departmentPrefix: v.string(),
        departmentName: v.optional(v.string()),
      }),
      courses: v.array(
        v.object({
          id: v.string(),
          code: v.string(),
          title: v.string(),
          departmentPrefix: v.string(),
          credits: v.number(),
          description: v.string(),
        })
      ),
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
              courseId: v.string(),
              refreshedAt: v.number(),
              instructorTBD: v.boolean(),
              isOnline: v.boolean(),
            })
          ),
        })
      ),
      ratings: v.array(
        v.object({
          id: v.string(),
          courseId: v.string(),
          courseCode: v.string(),
          courseTitle: v.string(),
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
      similarProfessors: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          designation: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
          departmentPrefix: v.string(),
          sharedCourseCount: v.number(),
          sharedCourses: v.array(
            v.object({
              id: v.string(),
              code: v.string(),
              title: v.string(),
            })
          ),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const professor = await ctx.db
      .query("professors")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.id))
      .first();
    if (!professor) {
      return null;
    }

    const department = await ctx.db
      .query("departments")
      .withIndex("by_prefix", (q) => q.eq("prefix", professor.departmentPrefix))
      .first();

    const courseLinks = await ctx.db
      .query("courseProfessors")
      .withIndex("by_professorId", (q) => q.eq("professorId", professor._id))
      .collect();

    const courses = (
      await Promise.all(courseLinks.map((link) => ctx.db.get(link.courseId)))
    ).filter((course): course is NonNullable<typeof course> => !!course);

    const sections = await ctx.db
      .query("sections")
      .withIndex("by_professorId", (q) => q.eq("professorId", professor._id))
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
      {
        term: (typeof terms)[number];
        sections: typeof sections;
      }
    >();

    for (const section of sections) {
      const term = termMap.get(section.termCode);
      if (!term) {
        continue;
      }
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

    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_professorId", (q) => q.eq("professorId", professor._id))
      .collect();

    const approvedRatings = ratings.filter(
      (rating) => rating.status === "APPROVED"
    );
    const courseById = new Map(courses.map((course) => [course._id, course]));

    const ratingsWithCourse = approvedRatings
      .map((rating) => {
        const course = courseById.get(rating.courseId);
        if (!course) {
          return null;
        }
        return {
          id: rating._id,
          courseId: course.externalId,
          courseCode: course.code,
          courseTitle: course.title,
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

    const courseIds = courses.map((course) => course._id);
    const similarMap = new Map<
      string,
      {
        professor: Doc<"professors">;
        sharedCourses: Array<{ id: string; code: string; title: string }>;
        sharedCourseCount: number;
      }
    >();

    for (const courseId of courseIds) {
      const links = await ctx.db
        .query("courseProfessors")
        .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
        .collect();
      for (const link of links) {
        if (link.professorId === professor._id) {
          continue;
        }
        const otherProfessor = await ctx.db.get(link.professorId);
        const course = courseById.get(courseId);

        if (!(otherProfessor && course)) {
          continue;
        }
        const entry = similarMap.get(otherProfessor._id) ?? {
          professor: otherProfessor,
          sharedCourses: [],
          sharedCourseCount: 0,
        };
        entry.sharedCourses.push({
          id: course.externalId,
          code: course.code,
          title: course.title,
        });
        entry.sharedCourseCount += 1;
        similarMap.set(otherProfessor._id, entry);
      }
    }

    const similarProfessors = Array.from(similarMap.values())
      .sort((a, b) => b.sharedCourseCount - a.sharedCourseCount)
      .slice(0, 10)
      .map((entry) => ({
        id: entry.professor.externalId,
        name: entry.professor.name,
        designation: entry.professor.designation,
        imageUrl: entry.professor.imageUrl,
        departmentPrefix: entry.professor.departmentPrefix,
        sharedCourseCount: entry.sharedCourseCount,
        sharedCourses: entry.sharedCourses,
      }));

    return {
      metadata: {
        id: professor.externalId,
        rmpId: professor.rmpId,
        name: professor.name,
        designation: professor.designation,
        officeLocation: professor.officeLocation,
        email: professor.email,
        phone: professor.phone,
        linkedinUrl: professor.linkedinUrl,
        websiteUrl: professor.websiteUrl,
        imageUrl: professor.imageUrl,
        lastPullFromRmp: professor.lastPullFromRmp,
        departmentPrefix: professor.departmentPrefix,
        departmentName: department?.name,
      },
      courses: courses.map((course) => ({
        id: course.externalId,
        code: course.code,
        title: course.title,
        departmentPrefix: course.departmentPrefix,
        credits: course.credits,
        description: course.description,
      })),
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
          courseId: section.courseExternalId,
          refreshedAt: section.refreshedAt,
          instructorTBD: section.instructorTBD,
          isOnline: section.isOnline,
        })),
      })),
      ratings: ratingsWithCourse,
      similarProfessors,
    };
  },
});
