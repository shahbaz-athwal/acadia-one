import { z } from "zod";
import type { Doc } from "../_generated/dataModel";

type ProgramEvaluation = Doc<"acadiaUserData">["programEvaluation"];
type CoursePlanningStatuses = NonNullable<
  Doc<"acadiaUserData">["coursePlanningStatuses"]
>;

export type CoursePlanningStatus = CoursePlanningStatuses[string];

export interface ExecutorPlannerOptions {
  treatInProgressAsSatisfied: boolean;
  targetCourseCount: number;
}

export interface TermDescriptor {
  code: string;
  name: string;
}

export interface TermScheduleSection {
  sectionId: string;
  courseCode: string;
  courseTitle?: string;
  sectionCode: string;
  termCode: string;
  classStartTime: string;
  classEndTime: string;
  daysOfWeek: string[];
  professorName: string;
  color?: string;
}

export interface RemainingRequirementGroup {
  requirementKey: string;
  requirementLabel: string;
  subrequirementLabel: string;
  groupLabel: string;
  groupType: "exact" | "search";
  directiveText?: string;
  satisfied: boolean;
  satisfiedByCourseCodes: string[];
  remainingCandidateCourseCodes: string[];
  offeredCandidateCourseCodes: string[];
  unavailableCandidateCourseCodes: string[];
}

export interface RequirementPlanningSnapshot {
  completedCourseCodes: string[];
  inProgressCourseCodes: string[];
  droppedCourseCodes: string[];
  withdrawnCourseCodes: string[];
  failedCourseCodes: string[];
  currentTermSchedule: TermScheduleSection[];
  remainingRequirementGroups: RemainingRequirementGroup[];
  warnings: string[];
}

export interface PlannerExecutionResult {
  termCode: string;
  saved: boolean;
  summary: string;
  studentMessage: string;
  selectedSections: TermScheduleSection[];
  satisfiedRequirementKeys: string[];
  unresolvedRequirementKeys: string[];
  warnings: string[];
  toolTrace?: {
    searchedCourseCodes: string[];
    conflictChecks: number;
    saveMode: "replaceTerm";
  };
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

function toOptionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toUniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function joinValues(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)";
}

function formatScheduleSection(section: TermScheduleSection): string {
  const days =
    section.daysOfWeek.length > 0 ? section.daysOfWeek.join("/") : "TBD days";
  return `${section.courseCode} ${section.sectionCode} | ${days} ${section.classStartTime}-${section.classEndTime} | ${section.professorName}`;
}

function shouldStatusCountAsSatisfied(
  status: CoursePlanningStatus | undefined,
  treatInProgressAsSatisfied: boolean
): boolean {
  return (
    status === "completed" ||
    (treatInProgressAsSatisfied && status === "inProgress")
  );
}

export function buildRequirementKey(
  requirementCode: string,
  subrequirementId: string,
  groupId: string
): string {
  return `${requirementCode}:${subrequirementId}:${groupId}`;
}

export function normalizePlannerOptions(
  options?: Partial<ExecutorPlannerOptions>
): ExecutorPlannerOptions {
  const targetCourseCount = options?.targetCourseCount;
  return {
    treatInProgressAsSatisfied: options?.treatInProgressAsSatisfied ?? false,
    targetCourseCount:
      typeof targetCourseCount === "number" &&
      Number.isFinite(targetCourseCount) &&
      targetCourseCount > 0
        ? Math.round(targetCourseCount)
        : 5,
  };
}

export function buildStatusBuckets(
  statuses: Doc<"acadiaUserData">["coursePlanningStatuses"]
) {
  const completedCourseCodes: string[] = [];
  const inProgressCourseCodes: string[] = [];
  const droppedCourseCodes: string[] = [];
  const withdrawnCourseCodes: string[] = [];
  const failedCourseCodes: string[] = [];

  for (const [courseCode, status] of Object.entries(statuses ?? {})) {
    if (status === "completed") {
      completedCourseCodes.push(courseCode);
      continue;
    }
    if (status === "inProgress") {
      inProgressCourseCodes.push(courseCode);
      continue;
    }
    if (status === "dropped") {
      droppedCourseCodes.push(courseCode);
      continue;
    }
    if (status === "withdrawn") {
      withdrawnCourseCodes.push(courseCode);
      continue;
    }
    if (status === "failed") {
      failedCourseCodes.push(courseCode);
    }
  }

  return {
    completedCourseCodes: toUniqueSortedStrings(completedCourseCodes),
    inProgressCourseCodes: toUniqueSortedStrings(inProgressCourseCodes),
    droppedCourseCodes: toUniqueSortedStrings(droppedCourseCodes),
    withdrawnCourseCodes: toUniqueSortedStrings(withdrawnCourseCodes),
    failedCourseCodes: toUniqueSortedStrings(failedCourseCodes),
  };
}

export function buildRemainingRequirementGroups(args: {
  programEvaluation: ProgramEvaluation;
  courseStatuses: Doc<"acadiaUserData">["coursePlanningStatuses"];
  treatInProgressAsSatisfied: boolean;
  offeredCourseCodeSet: ReadonlySet<string>;
  rsgByKey: ReadonlyMap<
    string,
    { courseCodes: string[]; type: "exact" | "search" }
  >;
}) {
  const warnings: string[] = [];
  const groups: RemainingRequirementGroup[] = [];

  for (const requirement of args.programEvaluation.requirements) {
    for (const subrequirement of requirement.subrequirements) {
      for (const group of subrequirement.groups) {
        const requirementKey = buildRequirementKey(
          requirement.code,
          subrequirement.id,
          group.id
        );
        const explicitCourseCodes = toUniqueSortedStrings(
          group.courses.map((course) => course.code)
        );
        const rsgEntry = args.rsgByKey.get(requirementKey);
        const candidateCourseCodes =
          explicitCourseCodes.length > 0
            ? explicitCourseCodes
            : toUniqueSortedStrings(rsgEntry?.courseCodes ?? []);
        const groupType =
          explicitCourseCodes.length > 0
            ? "exact"
            : (rsgEntry?.type ?? "search");
        const satisfiedByCourseCodes = candidateCourseCodes.filter(
          (courseCode) =>
            shouldStatusCountAsSatisfied(
              args.courseStatuses?.[courseCode],
              args.treatInProgressAsSatisfied
            )
        );
        const satisfied = satisfiedByCourseCodes.length > 0;

        if (explicitCourseCodes.length === 0 && !rsgEntry) {
          warnings.push(
            `No RSG entry was found for remaining requirement ${requirementKey}.`
          );
        }

        if (satisfied) {
          continue;
        }

        if (candidateCourseCodes.length === 0) {
          warnings.push(
            `No candidate course codes were available for remaining requirement ${requirementKey}.`
          );
        }

        const offeredCandidateCourseCodes = candidateCourseCodes.filter(
          (courseCode) => args.offeredCourseCodeSet.has(courseCode)
        );
        const unavailableCandidateCourseCodes = candidateCourseCodes.filter(
          (courseCode) => !args.offeredCourseCodeSet.has(courseCode)
        );

        groups.push({
          requirementKey,
          requirementLabel:
            toOptionalText(requirement.description) ?? requirement.code,
          subrequirementLabel:
            toOptionalText(subrequirement.displayText) ??
            toOptionalText(subrequirement.code) ??
            subrequirement.id,
          groupLabel:
            toOptionalText(group.displayText) ??
            toOptionalText(group.directive) ??
            group.id,
          groupType,
          directiveText:
            toOptionalText(group.directive) ??
            toOptionalText(subrequirement.directive) ??
            toOptionalText(requirement.directive),
          satisfied,
          satisfiedByCourseCodes,
          remainingCandidateCourseCodes: candidateCourseCodes,
          offeredCandidateCourseCodes,
          unavailableCandidateCourseCodes,
        });
      }
    }
  }

  return {
    groups,
    warnings: toUniqueSortedStrings(warnings),
  };
}

export function buildPlanningPrompt(args: {
  studentName: string;
  programTitle: string;
  programCode: string;
  term: TermDescriptor;
  instructions?: string;
  plannerOptions: ExecutorPlannerOptions;
  snapshot: RequirementPlanningSnapshot;
}) {
  const currentScheduleBlock =
    args.snapshot.currentTermSchedule.length > 0
      ? args.snapshot.currentTermSchedule
          .map((section) => `- ${formatScheduleSection(section)}`)
          .join("\n")
      : "- (none)";
  const unmetRequirementsBlock =
    args.snapshot.remainingRequirementGroups.length > 0
      ? args.snapshot.remainingRequirementGroups
          .map((group) =>
            [
              `Requirement Key: ${group.requirementKey}`,
              `Requirement: ${group.requirementLabel}`,
              `Subrequirement: ${group.subrequirementLabel}`,
              `Group: ${group.groupLabel}`,
              `Type: ${group.groupType}`,
              `Directive: ${group.directiveText ?? "(none)"}`,
              `Remaining candidate course codes: ${joinValues(group.remainingCandidateCourseCodes)}`,
              `Offered this term: ${joinValues(group.offeredCandidateCourseCodes)}`,
              `Not offered this term: ${joinValues(group.unavailableCandidateCourseCodes)}`,
            ].join("\n")
          )
          .join("\n\n")
      : "(none)";

  const system = [
    "You are a term schedule planning executor.",
    `Plan only for termCode ${args.term.code}.`,
    "Prioritize unmet program requirements only.",
    `Target ${args.plannerOptions.targetCourseCount} courses unless the available offerings or constraints make that impossible.`,
    "Do not add electives unrelated to unmet requirements.",
    "Respect the student instructions exactly.",
    "Use the provided tools to search sections, verify conflicts, and save the final schedule.",
    "Search courses before selecting sections.",
    "Run detect_conflicts on the exact final candidate section ids before saving.",
    "Only call save_schedule after detect_conflicts reports no invalid ids and no conflicts for that exact section set.",
    "The selected term schedule is replaced on save, so do not preserve old sections unless you intentionally choose them again.",
    "Your final response must be a structured object that matches the requested schema.",
    "Every selected section must include its own short summary explaining why that course fits.",
  ].join("\n");

  const prompt = [
    "Student Context",
    `Student: ${args.studentName}`,
    `Program: ${args.programTitle} (${args.programCode})`,
    `Selected term: ${args.term.name} (${args.term.code})`,
    `Custom instructions: ${toOptionalText(args.instructions) ?? "(none)"}`,
    `Target course count: ${args.plannerOptions.targetCourseCount}`,
    `Treat in-progress as satisfied: ${args.plannerOptions.treatInProgressAsSatisfied ? "yes" : "no"}`,
    "",
    "Student History",
    `Completed: ${joinValues(args.snapshot.completedCourseCodes)}`,
    `In progress: ${joinValues(args.snapshot.inProgressCourseCodes)}`,
    `Dropped: ${joinValues(args.snapshot.droppedCourseCodes)}`,
    `Withdrawn: ${joinValues(args.snapshot.withdrawnCourseCodes)}`,
    `Failed: ${joinValues(args.snapshot.failedCourseCodes)}`,
    "",
    "Current Saved Schedule For Selected Term",
    currentScheduleBlock,
    "",
    "Remaining Requirements",
    unmetRequirementsBlock,
    "",
    "Warnings",
    joinValues(args.snapshot.warnings),
    "",
    "Tool usage requirements",
    "1. Search sections for offered candidate course codes tied to unmet requirements.",
    "2. Choose sections that satisfy the most remaining requirements while honoring the student instructions.",
    "3. Detect conflicts on the exact final candidate section ids.",
    "4. Save with replaceTerm only after the final candidate set is conflict-free.",
    "5. In the final object, explain what was scheduled and what still remains unresolved.",
    "6. For each selected section, include a brief user-facing summary specific to that course or section.",
    "7. Per-section summaries should mention unmet requirement coverage and major instruction or time-fit when relevant.",
    "8. Do not reuse the same generic summary text across all selected sections.",
  ].join("\n");

  return { system, prompt };
}

export function resolveRequirementOutcomes(
  remainingRequirementGroups: RemainingRequirementGroup[],
  selectedCourseCodes: ReadonlySet<string>
) {
  const satisfiedRequirementKeys: string[] = [];
  const unresolvedRequirementKeys: string[] = [];

  for (const group of remainingRequirementGroups) {
    const isSatisfied = group.remainingCandidateCourseCodes.some((courseCode) =>
      selectedCourseCodes.has(courseCode)
    );

    if (isSatisfied) {
      satisfiedRequirementKeys.push(group.requirementKey);
      continue;
    }

    unresolvedRequirementKeys.push(group.requirementKey);
  }

  return {
    satisfiedRequirementKeys: toUniqueSortedStrings(satisfiedRequirementKeys),
    unresolvedRequirementKeys: toUniqueSortedStrings(unresolvedRequirementKeys),
  };
}

export function buildPlannerSummary(args: {
  term: TermDescriptor;
  saved: boolean;
  selectedSections: TermScheduleSection[];
  satisfiedRequirementKeys: string[];
  unresolvedRequirementKeys: string[];
  warnings: string[];
}) {
  if (!args.saved) {
    return [
      `No schedule was saved for ${args.term.name} (${args.term.code}).`,
      args.unresolvedRequirementKeys.length > 0
        ? `${args.unresolvedRequirementKeys.length} remaining requirement group${args.unresolvedRequirementKeys.length === 1 ? "" : "s"} are still unresolved.`
        : "",
      args.warnings.length > 0 ? args.warnings[0] : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `Saved ${args.selectedSections.length} section${args.selectedSections.length === 1 ? "" : "s"} for ${args.term.name} (${args.term.code}).`,
    args.satisfiedRequirementKeys.length > 0
      ? `${args.satisfiedRequirementKeys.length} remaining requirement group${args.satisfiedRequirementKeys.length === 1 ? "" : "s"} are now covered.`
      : "",
    args.unresolvedRequirementKeys.length > 0
      ? `${args.unresolvedRequirementKeys.length} group${args.unresolvedRequirementKeys.length === 1 ? "" : "s"} remain unresolved.`
      : "No unmet requirement groups remain from the executor target set.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function dedupeWarnings(values: string[]) {
  return toUniqueSortedStrings(values);
}
