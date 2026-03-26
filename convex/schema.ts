import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { literals, typedV } from "convex-helpers/validators";

const schema = defineSchema({
  acadiaSessions: defineTable({
    sessionId: v.string(),
    cookies: v.string(),
    lastAcadiaAuth: v.number(),
    expiresAt: v.number(),
    updatedAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),
  // Put user data in a new table. Instead of encrypted credentials, only store encrypted passwords.
  acadiaUsers: defineTable({
    sessionId: v.string(),
    studentId: v.string(),
    encryptedCredentials: v.string(),
    tokenHash: v.string(),
    updatedAt: v.number(),
    userDataStatus: literals("pending", "ready", "error"),
    userDataPullError: v.optional(v.string()),
  }).index("by_sessionId", ["sessionId"]),

  // Large user payloads are isolated to keep `acadiaUsers` lightweight.
  acadiaUserData: defineTable({
    sessionId: v.string(),
    profile: v.object({
      id: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      preferredEmail: v.string(),
    }),
    programs: v.array(
      v.object({
        studentId: v.string(),
        programCode: v.string(),
        programName: v.string(),
        degreeCode: v.string(),
        catalogCode: v.string(),
        departmentCode: v.string(),
        academicLevelCode: v.string(),
        location: v.string(),
        status: v.string(),
        hasGraduated: v.boolean(),
        startDate: v.union(v.string(), v.null()),
        endDate: v.union(v.string(), v.null()),
        anticipatedCompletionDate: v.union(v.string(), v.null()),
        majors: v.array(
          v.object({
            code: v.string(),
            name: v.string(),
            startDate: v.union(v.string(), v.null()),
            endDate: v.union(v.string(), v.null()),
          })
        ),
        minors: v.array(
          v.object({
            code: v.string(),
            name: v.string(),
            startDate: v.union(v.string(), v.null()),
            endDate: v.union(v.string(), v.null()),
          })
        ),
      })
    ),
    grades: v.object({
      terms: v.array(
        v.object({
          termName: v.string(),
          termYear: v.number(),
          startDate: v.string(),
          endDate: v.string(),
          gpa: v.union(v.number(), v.null()),
          courses: v.array(
            v.object({
              courseCode: v.string(),
              title: v.string(),
              credits: v.string(),
              startDate: v.union(v.string(), v.null()),
              endDate: v.union(v.string(), v.null()),
              finalGrade: v.string(),
            })
          ),
        })
      ),
    }),
    programEvaluation: v.object({
      code: v.string(),
      academicLevelCode: v.string(),
      title: v.string(),
      requirements: v.array(
        v.object({
          id: v.string(),
          code: v.string(),
          description: v.string(),
          directive: v.string(),
          completionStatus: v.union(v.string(), v.null()),
          subrequirements: v.array(
            v.object({
              id: v.string(),
              code: v.string(),
              displayText: v.string(),
              directive: v.string(),
              completionStatus: v.union(v.string(), v.null()),
              groups: v.array(
                v.object({
                  id: v.string(),
                  displayText: v.string(),
                  directive: v.string(),
                  completionStatus: v.union(v.string(), v.null()),
                  courses: v.array(
                    v.object({
                      id: v.string(),
                      code: v.string(),
                      number: v.string(),
                      title: v.string(),
                      courseName: v.string(),
                    })
                  ),
                })
              ),
            })
          ),
        })
      ),
    }),
    coursePlanningStatuses: v.optional(
      v.record(
        v.string(),
        literals("completed", "inProgress", "dropped", "withdrawn", "failed")
      )
    ),
    updatedAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  departments: defineTable({
    prefix: v.string(),
    name: v.string(),
    websiteUrl: v.optional(v.string()),
    facultyUrl: v.optional(v.string()),
  }).index("by_prefix", ["prefix"]),

  terms: defineTable({
    code: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    startDate: v.number(),
    endDate: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_isActive", ["isActive"]),

  professors: defineTable({
    externalId: v.string(),
    rmpId: v.optional(v.string()),
    rmpLegacyId: v.optional(v.number()),
    departmentPrefix: v.string(),
    name: v.string(),
    designation: v.optional(v.string()),
    officeLocation: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    researchAreas: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
    lastFacultyEnrichedAt: v.optional(v.number()),
    lastPullFromRmp: v.optional(v.number()),
    ratingCount: v.number(),
    avgDifficulty: v.union(v.number(), v.null()),
    avgQuality: v.union(v.number(), v.null()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_rmpId", ["rmpId"])
    .index("by_departmentPrefix", ["departmentPrefix"])
    .searchIndex("search_professors", {
      searchField: "name",
      filterFields: ["departmentPrefix"],
    }),

  courses: defineTable({
    externalId: v.string(),
    code: v.string(),
    title: v.string(),
    description: v.string(),
    departmentPrefix: v.string(),
    matchingSectionIds: v.array(v.string()),
    credits: v.number(),
    isLab: v.boolean(),
    academicLevel: v.number(),
    requisites: v.optional(
      v.array(
        v.object({
          codes: v.array(v.string()),
          displayText: v.string(),
          displayTextAnnotated: v.string(),
          displayTextExtension: v.string(),
          displayTextExtensionAnnotated: v.optional(v.string()),
        })
      )
    ),
    lastSectionPulledAt: v.optional(v.number()),
    ratingCount: v.number(),
    avgDifficulty: v.union(v.number(), v.null()),
    avgQuality: v.union(v.number(), v.null()),
    // Denormalized section filter fields (populated by recomputeCourseSectionFilters)
    sectionTermCodes: v.optional(v.array(v.string())),
    sectionProfessorIds: v.optional(v.array(v.id("professors"))),
    sectionDays: v.optional(v.array(v.number())),
    // Concatenated search field: "<code> <title> <description>"
    searchText: v.optional(v.string()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_code", ["code"])
    .index("by_departmentPrefix", ["departmentPrefix"])
    .index("by_academicLevel", ["academicLevel"])
    .searchIndex("search_courses", {
      searchField: "searchText",
      filterFields: ["departmentPrefix"],
    }),

  courseProfessors: defineTable({
    courseId: v.id("courses"),
    professorId: v.id("professors"),
    courseExternalId: v.string(),
    professorExternalId: v.string(),
  })
    .index("by_courseId", ["courseId"])
    .index("by_professorId", ["professorId"])
    .index("by_courseId_and_professorId", ["courseId", "professorId"])
    .index("by_courseExternalId", ["courseExternalId"])
    .index("by_professorExternalId", ["professorExternalId"]),

  sections: defineTable({
    externalId: v.string(),
    termCode: v.string(),
    courseId: v.id("courses"),
    courseExternalId: v.string(),
    professorId: v.optional(v.id("professors")),
    sectionCode: v.string(),
    sectionSearchName: v.string(),
    classStartTime: v.string(),
    classEndTime: v.string(),
    classStartMin: v.optional(v.number()),
    classEndMin: v.optional(v.number()),
    buildingName: v.string(),
    roomNumber: v.string(),
    days: v.array(v.number()),
    refreshedAt: v.number(),
    instructorTBD: v.boolean(),
    isOnline: v.boolean(),
  })
    .index("by_courseId", ["courseId"])
    .index("by_courseExternalId", ["courseExternalId"])
    .index("by_termCode", ["termCode"])
    .index("by_classStartMin", ["classStartMin"])
    .index("by_termCode_and_classStartMin", ["termCode", "classStartMin"])
    .index("by_professorId", ["professorId"])
    .index("by_externalId_and_termCode", ["externalId", "termCode"]),

  scheduleItems: defineTable({
    sessionId: v.string(),
    sectionId: v.id("sections"),
    color: v.string(),
    isAiSuggested: v.optional(v.boolean()),
    aiSuggestionSummary: v.optional(v.string()),
    addedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_sectionId", ["sessionId", "sectionId"]),

  courseStats: defineTable({
    key: v.string(), // "total" or "dept:<PREFIX>"
    courseCount: v.number(),
  }).index("by_key", ["key"]),

  rsg: defineTable({
    key: v.string(), // "<requirementCode>:<subrequirementId>:<groupId>"
    courseCodes: v.array(v.string()),
    type: literals("exact", "search"),
  }).index("by_key", ["key"]),

  ratings: defineTable({
    rmpId: v.optional(v.string()),
    rmpLegacyId: v.optional(v.number()),
    status: v.string(),
    quality: v.number(),
    difficulty: v.number(),
    isForCredit: v.optional(v.boolean()),
    comment: v.optional(v.string()),
    textBookRequired: v.optional(v.boolean()),
    attendanceRequired: v.boolean(),
    gradeReceived: v.optional(v.string()),
    wouldTakeAgain: v.optional(v.boolean()),
    thumbsUpTotal: v.number(),
    thumbsDownTotal: v.number(),
    tags: v.array(v.string()),
    professorId: v.id("professors"),
    courseId: v.id("courses"),
    postedAt: v.number(),
  })
    .index("by_rmpId", ["rmpId"])
    .index("by_rmpLegacyId", ["rmpLegacyId"])
    .index("by_professorId", ["professorId"])
    .index("by_courseId", ["courseId"])
    .index("by_status", ["status"]),
});

export const vv = typedV(schema);
export default schema;
