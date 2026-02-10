import { z } from "zod";

export const SectionDetailsFilteredResponseSchema = z
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
