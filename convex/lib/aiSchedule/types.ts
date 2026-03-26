import { z } from "zod";

export interface ExecutorPlannerOptions {
  targetCourseCount: number;
}

export interface TermDescriptor {
  code: string;
  name: string;
}

export interface TermScheduleSection {
  classEndTime: string;
  classStartTime: string;
  color?: string;
  courseCode: string;
  courseTitle?: string;
  daysOfWeek: string[];
  professorName: string;
  sectionCode: string;
  sectionId: string;
  termCode: string;
}

export interface CompletedCourseContext {
  courseCode: string;
  courseTitle: string;
}

export interface InProgressCourseContext {
  courseCode: string;
  courseTitle: string;
}

export interface OfferedCourseContext {
  courseCode: string;
  courseTitle: string;
}

export interface UnmetRequirementGroup {
  groupCompletionStatus?: string;
  groupLabel: string;
  groupType: "exact" | "search";
  offeredCourses: OfferedCourseContext[];
  requirementCompletionStatus?: string;
  requirementKey: string;
  requirementLabel: string;
  subrequirementCompletionStatus?: string;
  subrequirementLabel: string;
}

export interface RequirementPlanningSnapshot {
  completedCourses: CompletedCourseContext[];
  currentTermSchedule: TermScheduleSection[];
  inProgressCourses: InProgressCourseContext[];
  treatInProgressAsSatisfied: boolean;
  unmetRequirementGroups: UnmetRequirementGroup[];
  warnings: string[];
}

export interface PlannerExecutionResult {
  satisfiedRequirementKeys: string[];
  saved: boolean;
  selectedSections: TermScheduleSection[];
  studentMessage: string;
  summary: string;
  termCode: string;
  toolTrace?: {
    searchedCourseCodes: string[];
    conflictChecks: number;
    saveMode: "replaceTerm";
  };
  unresolvedRequirementKeys: string[];
  warnings: string[];
}

export const PlannerModelOutputSchema = z.object({
  selectedSections: z.array(
    z.object({
      sectionId: z.string().trim().min(1),
      courseCode: z.string().trim().min(1),
      sectionCode: z.string().trim().min(1),
      summary: z.string().trim().min(1),
    })
  ),
  satisfiedRequirementKeys: z.array(z.string().trim().min(1)),
  unresolvedRequirementKeys: z.array(z.string().trim().min(1)),
  warnings: z.array(z.string().trim().min(1)),
  studentMessage: z.string().trim().min(1),
});

export type PlannerModelOutput = z.infer<typeof PlannerModelOutputSchema>;
