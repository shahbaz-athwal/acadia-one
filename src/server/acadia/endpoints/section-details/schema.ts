import { z } from "zod";

// oxlint-disable sort-keys typescript/no-unsafe-type-assertion
import type { CourseId, ProfessorId, SectionId } from "@/db/schema";

const CourseIdSchema = z.string().transform((id) => id as CourseId);
const ProfessorIdSchema = z.string().transform((id) => id as ProfessorId);
const SectionIdSchema = z.string().transform((id) => id as SectionId);
const NullableStringSchema = z
  .string()
  .nullable()
  .transform((value) => (value === "" ? null : value));

export const SectionDetailsResponseSchema = z
  .object({
    SectionsRetrieved: z.object({
      TermsAndSections: z.array(
        z.object({
          Term: z.object({
            Code: z.string(),
            Description: z.string(),
            StartDate: z.string(),
            EndDate: z.string(),
          }),
          Sections: z.array(
            z.object({
              Section: z.object({
                CourseId: CourseIdSchema,
                FormattedMeetingTimes: z.array(
                  z.object({
                    InstructionalMethodDisplay: z.string(),
                    DaysOfWeekDisplay: z.string(),
                    StartTime: NullableStringSchema,
                    EndTime: NullableStringSchema,
                    BuildingDisplay: z.string(),
                    RoomDisplay: z.string(),
                    ShowTBD: z.boolean(),
                    Days: z.array(z.number()),
                    Room: NullableStringSchema,
                    IsOnline: z.boolean(),
                  })
                ),
                Id: SectionIdSchema,
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
                  FacultyId: ProfessorIdSchema,
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
          termCode: termData.Term.Code,
          name: termData.Term.Description,
          startDate: termData.Term.StartDate,
          endDate: termData.Term.EndDate,
        },
        sectionCode: sectionData.Section.Number,
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
            startTime: meeting.StartTime,
            endTime: meeting.EndTime,
            buildingName: meeting.BuildingDisplay,
            roomNumber: meeting.RoomDisplay,
            room: meeting.Room,
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

export type AcadiaSection = z.infer<
  typeof SectionDetailsResponseSchema
>[number];
