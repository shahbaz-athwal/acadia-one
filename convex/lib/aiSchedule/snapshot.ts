import type { Doc } from "../../_generated/dataModel";
import type {
  CompletedCourseContext,
  InProgressCourseContext,
  OfferedCourseContext,
  RequirementPlanningSnapshot,
  UnmetRequirementGroup,
} from "./types";

type ProgramEvaluation = Doc<"acadiaUserData">["programEvaluation"];
type CoursePlanningStatuses = Doc<"acadiaUserData">["coursePlanningStatuses"];
type CoursePlanningStatus = NonNullable<CoursePlanningStatuses>[string];

function toOptionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toUniqueSortedStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function sortCourses<T extends { courseCode: string }>(courses: T[]) {
  return [...courses].sort((left, right) =>
    left.courseCode.localeCompare(right.courseCode)
  );
}

function resolveCourseTitle(
  courseCode: string,
  courseTitleByCode: ReadonlyMap<string, string>
) {
  return courseTitleByCode.get(courseCode) ?? courseCode;
}

function shouldStatusCountAsSatisfied(
  status: CoursePlanningStatus | undefined,
  treatInProgressAsSatisfied: boolean
) {
  return (
    status === "completed" ||
    (treatInProgressAsSatisfied && status === "inProgress")
  );
}

function toCourseList(
  courseCodes: string[],
  courseTitleByCode: ReadonlyMap<string, string>
): OfferedCourseContext[] {
  return sortCourses(
    toUniqueSortedStrings(courseCodes).map((courseCode) => ({
      courseCode,
      courseTitle: resolveCourseTitle(courseCode, courseTitleByCode),
    }))
  );
}

export function buildRequirementKey(
  requirementCode: string,
  subrequirementId: string,
  groupId: string
) {
  return `${requirementCode}:${subrequirementId}:${groupId}`;
}

export function normalizeCourseCodes(values: string[]) {
  return toUniqueSortedStrings(values.map((value) => value.toUpperCase()));
}

export function dedupeWarnings(values: string[]) {
  return toUniqueSortedStrings(values);
}

export function buildCompletedCourses(args: {
  courseStatuses: CoursePlanningStatuses;
  courseTitleByCode: ReadonlyMap<string, string>;
}): CompletedCourseContext[] {
  const completedCourseCodes = Object.entries(args.courseStatuses ?? {})
    .filter(([, status]) => status === "completed")
    .map(([courseCode]) => courseCode);

  return sortCourses(
    normalizeCourseCodes(completedCourseCodes).map((courseCode) => ({
      courseCode,
      courseTitle: resolveCourseTitle(courseCode, args.courseTitleByCode),
    }))
  );
}

export function buildInProgressCourses(args: {
  courseStatuses: CoursePlanningStatuses;
  courseTitleByCode: ReadonlyMap<string, string>;
}): InProgressCourseContext[] {
  const inProgressCourseCodes = Object.entries(args.courseStatuses ?? {})
    .filter(([, status]) => status === "inProgress")
    .map(([courseCode]) => courseCode);

  return sortCourses(
    normalizeCourseCodes(inProgressCourseCodes).map((courseCode) => ({
      courseCode,
      courseTitle: resolveCourseTitle(courseCode, args.courseTitleByCode),
    }))
  );
}

export function collectCandidateCourseCodes(args: {
  programEvaluation: ProgramEvaluation;
  rsgByKey: ReadonlyMap<
    string,
    { courseCodes: string[]; type: "exact" | "search" }
  >;
}) {
  const courseCodes: string[] = [];

  for (const requirement of args.programEvaluation.requirements) {
    for (const subrequirement of requirement.subrequirements) {
      for (const group of subrequirement.groups) {
        if (group.courses.length > 0) {
          courseCodes.push(...group.courses.map((course) => course.code));
          continue;
        }

        const key = buildRequirementKey(
          requirement.code,
          subrequirement.id,
          group.id
        );
        courseCodes.push(...(args.rsgByKey.get(key)?.courseCodes ?? []));
      }
    }
  }

  return normalizeCourseCodes(courseCodes);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function flattens nested program-evaluation data into a planner snapshot.
export function buildPlanningSnapshot(args: {
  courseStatuses: CoursePlanningStatuses;
  courseTitleByCode: ReadonlyMap<string, string>;
  currentTermSchedule: RequirementPlanningSnapshot["currentTermSchedule"];
  offeredCourseCodeSet: ReadonlySet<string>;
  programEvaluation: ProgramEvaluation;
  rsgByKey: ReadonlyMap<
    string,
    { courseCodes: string[]; type: "exact" | "search" }
  >;
  treatInProgressAsSatisfied: boolean;
}) {
  const warnings: string[] = [];
  const unmetRequirementGroups: UnmetRequirementGroup[] = [];

  for (const requirement of args.programEvaluation.requirements) {
    if (requirement.completionStatus === "Completed") {
      continue;
    }

    for (const subrequirement of requirement.subrequirements) {
      if (subrequirement.completionStatus === "Completed") {
        continue;
      }

      for (const group of subrequirement.groups) {
        if (group.completionStatus === "Completed") {
          continue;
        }

        const requirementKey = buildRequirementKey(
          requirement.code,
          subrequirement.id,
          group.id
        );
        const explicitCourseCodes = normalizeCourseCodes(
          group.courses.map((course) => course.code)
        );
        const rsgEntry = args.rsgByKey.get(requirementKey);
        const candidateCourseCodes =
          explicitCourseCodes.length > 0
            ? explicitCourseCodes
            : normalizeCourseCodes(rsgEntry?.courseCodes ?? []);

        if (explicitCourseCodes.length === 0 && !rsgEntry) {
          warnings.push(
            `No RSG entry was found for unmet requirement ${requirementKey}.`
          );
        }

        if (
          candidateCourseCodes.some((courseCode) =>
            shouldStatusCountAsSatisfied(
              args.courseStatuses?.[courseCode],
              args.treatInProgressAsSatisfied
            )
          )
        ) {
          continue;
        }

        if (candidateCourseCodes.length === 0) {
          warnings.push(
            `No candidate course codes were available for unmet requirement ${requirementKey}.`
          );
        }

        const offeredCourses = toCourseList(
          candidateCourseCodes.filter((courseCode) =>
            args.offeredCourseCodeSet.has(courseCode)
          ),
          args.courseTitleByCode
        );

        unmetRequirementGroups.push({
          requirementKey,
          requirementLabel:
            toOptionalText(requirement.description) ?? requirement.code,
          requirementCompletionStatus:
            toOptionalText(requirement.completionStatus) ?? undefined,
          subrequirementLabel:
            toOptionalText(subrequirement.displayText) ??
            toOptionalText(subrequirement.code) ??
            subrequirement.id,
          subrequirementCompletionStatus:
            toOptionalText(subrequirement.completionStatus) ?? undefined,
          groupLabel:
            toOptionalText(group.displayText) ??
            toOptionalText(group.directive) ??
            group.id,
          groupCompletionStatus:
            toOptionalText(group.completionStatus) ?? undefined,
          groupType:
            explicitCourseCodes.length > 0
              ? "exact"
              : (rsgEntry?.type ?? "search"),
          offeredCourses,
        });
      }
    }
  }

  return {
    completedCourses: buildCompletedCourses({
      courseStatuses: args.courseStatuses,
      courseTitleByCode: args.courseTitleByCode,
    }),
    currentTermSchedule: args.currentTermSchedule,
    inProgressCourses: buildInProgressCourses({
      courseStatuses: args.courseStatuses,
      courseTitleByCode: args.courseTitleByCode,
    }),
    treatInProgressAsSatisfied: args.treatInProgressAsSatisfied,
    unmetRequirementGroups,
    warnings: dedupeWarnings(warnings),
  } satisfies RequirementPlanningSnapshot;
}
