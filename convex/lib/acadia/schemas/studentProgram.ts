import { z } from "zod";

const StudentProgramMajorMinorSchema = z.object({
  Code: z.string(),
  Name: z.string(),
  StartDate: z.string().nullable(),
  EndDate: z.string().nullable(),
});

const StudentProgramSchema = z.object({
  StudentId: z.string(),
  ProgramCode: z.string(),
  CatalogCode: z.string(),
  AnticipatedCompletionDate: z.string().nullable(),
  EndDate: z.string().nullable(),
  AcadEndDate: z.string().nullable(),
  StartDate: z.string().nullable(),
  AcadStartDate: z.string().nullable(),
  AcademicLevelCode: z.string(),
  DegreeCode: z.string(),
  AdmitStatusCode: z.string(),
  HasGraduated: z.boolean(),
  ProgramName: z.string(),
  DepartmentCode: z.string(),
  Location: z.string(),
  ProgramStatusProcessingCode: z.string(),
  StudentProgramMajors: z.array(StudentProgramMajorMinorSchema),
  StudentProgramMinors: z.array(StudentProgramMajorMinorSchema),
  AdditionalRequirements: z.array(z.unknown()),
});

const StudentProfileSchema = z.object({
  Id: z.string(),
  LastName: z.string(),
  FirstName: z.string(),
  PreferredEmailAddress: z.string(),
});

export const StudentProgramDetailsFilteredResponseSchema = z
  .object({
    StudentPrograms: z.array(StudentProgramSchema),
    StudentProfile: StudentProfileSchema,
  })
  .transform((data) => ({
    programs: data.StudentPrograms.map((program) => ({
      studentId: program.StudentId,
      programCode: program.ProgramCode,
      programName: program.ProgramName,
      degreeCode: program.DegreeCode,
      catalogCode: program.CatalogCode,
      departmentCode: program.DepartmentCode,
      academicLevelCode: program.AcademicLevelCode,
      location: program.Location,
      status: program.ProgramStatusProcessingCode,
      hasGraduated: program.HasGraduated,
      startDate: program.StartDate,
      endDate: program.EndDate,
      anticipatedCompletionDate: program.AnticipatedCompletionDate,
      majors: program.StudentProgramMajors.map((major) => ({
        code: major.Code,
        name: major.Name,
        startDate: major.StartDate,
        endDate: major.EndDate,
      })),
      minors: program.StudentProgramMinors.map((minor) => ({
        code: minor.Code,
        name: minor.Name,
        startDate: minor.StartDate,
        endDate: minor.EndDate,
      })),
    })),
    profile: {
      id: data.StudentProfile.Id,
      firstName: data.StudentProfile.FirstName,
      lastName: data.StudentProfile.LastName,
      preferredEmail: data.StudentProfile.PreferredEmailAddress,
    },
  }));

export type StudentProgramDetailsTransformed = z.infer<
  typeof StudentProgramDetailsFilteredResponseSchema
>;
