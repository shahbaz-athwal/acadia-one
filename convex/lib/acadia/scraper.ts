"use node";

import type { AxiosInstance } from "axios";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import {
  authenticateWithAxios,
  createClient,
  DEFAULT_AUTH_TIMEOUT_MS,
} from "./auth";

const PostSearchCriteriaRequestSchema = z.object({
  keyword: z.string().nullable(),
  terms: z.array(z.string()),
  courseIds: z.null(),
  sectionIds: z.null(),
  subjects: z.array(z.string()),
  faculty: z.array(z.coerce.number()),
  pageNumber: z.number(),
  quantityPerPage: z.number(),
});

const PostSearchCriteriaFilteredResponseSchema = z
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
        code: req.DisplayText.split(" ")[0]?.split("-").join("") || "",
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

const SectionDetailsFilteredResponseSchema = z
  .object({
    SectionsRetrieved: z.object({
      TermsAndSections: z.array(
        z.object({
          Term: z.object({
            Code: z.string(),
            Description: z.string(),
            StartDate: z.string(),
            EndDate: z.string(),
            IsActive: z.boolean(),
          }),
          Sections: z.array(
            z.object({
              Section: z.object({
                CourseId: z.string(),
                FormattedMeetingTimes: z.array(
                  z.object({
                    InstructionalMethodDisplay: z.string(),
                    DaysOfWeekDisplay: z.string(),
                    StartTimeDisplay: z.string(),
                    EndTimeDisplay: z.string(),
                    BuildingDisplay: z.string(),
                    RoomDisplay: z.string(),
                    ShowTBD: z.boolean(),
                    Days: z.array(z.number()),
                    Room: z.string(),
                    IsOnline: z.boolean(),
                  })
                ),
                Id: z.string(),
                Available: z.number(),
                Capacity: z.number(),
                Enrolled: z.number(),
                Waitlisted: z.number(),
                CourseName: z.string(),
                SectionNameDisplay: z.string(),
                Number: z.string(),
                LocationDisplay: z.string(),
              }),
              InstructorDetails: z.array(
                z.object({
                  FacultyId: z.string(),
                  FacultyName: z.string(),
                })
              ),
            })
          ),
        })
      ),
    }),
  })
  .transform((data) =>
    data.SectionsRetrieved.TermsAndSections.flatMap((termData) =>
      termData.Sections.map((sectionData) => ({
        id: sectionData.Section.Id,
        courseId: sectionData.Section.CourseId,
        term: {
          code: termData.Term.Code,
          name: termData.Term.Description,
          startDate: termData.Term.StartDate,
          endDate: termData.Term.EndDate,
          isActive: termData.Term.IsActive,
        },
        sectionCode: sectionData.Section.SectionNameDisplay.split("-")[2] || "",
        sectionSearchName: sectionData.Section.SectionNameDisplay,
        courseName: sectionData.Section.CourseName,
        location: sectionData.Section.LocationDisplay,
        enrollment: {
          available: sectionData.Section.Available,
          capacity: sectionData.Section.Capacity,
          enrolled: sectionData.Section.Enrolled,
          waitlisted: sectionData.Section.Waitlisted,
        },
        meetingTimes: sectionData.Section.FormattedMeetingTimes.map(
          (meeting) => ({
            instructionalMethod: meeting.InstructionalMethodDisplay,
            daysOfWeek: meeting.DaysOfWeekDisplay,
            startTime: meeting.StartTimeDisplay,
            endTime: meeting.EndTimeDisplay,
            buildingName: meeting.BuildingDisplay,
            roomNumber: meeting.RoomDisplay,
            showTBD: meeting.ShowTBD,
            days: meeting.Days,
            isOnline: meeting.IsOnline,
          })
        ),
        instructors: sectionData.InstructorDetails.map((instructor) => ({
          id: instructor.FacultyId,
          name: instructor.FacultyName,
        })),
      }))
    )
  );

const ACADIA_AUTH_PROVIDER = "default";

export class AcadiaScraper {
  private readonly client: AxiosInstance;
  private readonly cookies: string;

  constructor(cookies: string, clientInstance: AxiosInstance = createClient()) {
    this.cookies = cookies;
    this.client = clientInstance;

    this.client.interceptors.request.use((config) => {
      config.headers.set("Accept", "application/json");
      config.headers.set("Cookie", this.cookies);
      return config;
    });
  }

  private async postSearchCriteria(
    searchCriteria?: Partial<z.infer<typeof PostSearchCriteriaRequestSchema>>
  ) {
    const defaultCriteria = {
      keyword: null,
      terms: [],
      courseIds: null,
      sectionIds: null,
      subjects: [],
      faculty: [],
      pageNumber: 1,
      quantityPerPage: 30,
    };

    const validatedCriteria = PostSearchCriteriaRequestSchema.parse({
      ...defaultCriteria,
      ...searchCriteria,
    });

    const response = await this.client.post(
      "/student/Student/Courses/PostSearchCriteria",
      validatedCriteria
    );

    return PostSearchCriteriaFilteredResponseSchema.parse(response.data);
  }

  async getAllDepartments() {
    const data = await this.postSearchCriteria();
    return data.subjects;
  }

  async getFacultiesByDepartment(departmentPrefix: string) {
    const data = await this.postSearchCriteria({
      subjects: [departmentPrefix],
    });
    return data.faculties;
  }

  async getAllCourses() {
    const data = await this.postSearchCriteria({ quantityPerPage: 3000 });
    return data.courses;
  }

  async getSectionDetails(courseId: string, sectionIds: string[]) {
    const response = await this.client.post(
      "/student/Student/Courses/Sections",
      {
        courseId,
        sectionIds,
      }
    );
    return SectionDetailsFilteredResponseSchema.parse(response.data);
  }
}

export async function getAcadiaScraper(ctx: ActionCtx) {
  const storedAuth = await ctx.runQuery(internal.internal.getAcadiaAuth, {
    provider: ACADIA_AUTH_PROVIDER,
  });
  const now = Date.now();
  if (storedAuth?.cookies && storedAuth.expiresAt > now) {
    return new AcadiaScraper(storedAuth.cookies);
  }

  const username = process.env.ACADIA_USERNAME;
  const password = process.env.ACADIA_PASSWORD;
  if (!username) {
    throw new Error("ACADIA_USERNAME is not set");
  }
  if (!password) {
    throw new Error("ACADIA_PASSWORD is not set");
  }

  const cookies = await authenticateWithAxios(username, password);

  const expiresAt = now + DEFAULT_AUTH_TIMEOUT_MS;
  await ctx.runMutation(internal.internal.upsertAcadiaAuth, {
    provider: ACADIA_AUTH_PROVIDER,
    cookies,
    encryptedCredentials: "",
    lastAcadiaAuth: now,
    expiresAt,
  });
  return new AcadiaScraper(cookies);
}
