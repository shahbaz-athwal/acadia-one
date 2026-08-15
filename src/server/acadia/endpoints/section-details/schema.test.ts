import { expect, test } from "bun:test";

import { SectionDetailsResponseSchema } from "./schema";

test("accepts unavailable enrollment counts for independent-study sections", () => {
  const result = SectionDetailsResponseSchema.parse({
    SectionsRetrieved: {
      TermsAndSections: [
        {
          Sections: [
            {
              InstructorDetails: [],
              Section: {
                Available: null,
                Capacity: null,
                CourseId: "13387",
                CourseName: "Honours Thesis 1",
                Enrolled: null,
                FormattedMeetingTimes: [
                  {
                    BuildingDisplay: "",
                    Days: [],
                    DaysOfWeekDisplay: "",
                    EndTime: null,
                    InstructionalMethodDisplay: "Independent Study",
                    IsOnline: false,
                    Room: null,
                    RoomDisplay: "",
                    ShowTBD: true,
                    StartTime: null,
                  },
                ],
                Id: "26405",
                LocationDisplay: "",
                Number: "01",
                SectionNameDisplay: "ECON-407T-01",
                Waitlisted: null,
              },
            },
          ],
          Term: {
            Code: "2026FA",
            Description: "Fall 2026",
            EndDate: "2026-12-20T00:00:00.000Z",
            StartDate: "2026-09-01T00:00:00.000Z",
          },
        },
      ],
    },
  });

  expect(result[0]?.enrollment).toEqual({
    available: null,
    capacity: null,
    enrolled: null,
    waitlisted: null,
  });
});
