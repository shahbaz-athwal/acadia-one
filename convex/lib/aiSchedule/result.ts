import { dedupeWarnings } from "./snapshot";
import type {
  PlannerExecutionResult,
  TermDescriptor,
  TermScheduleSection,
  UnmetRequirementGroup,
} from "./types";

export function resolveRequirementOutcomes(
  unmetRequirementGroups: UnmetRequirementGroup[],
  selectedCourseCodes: ReadonlySet<string>
) {
  const satisfiedRequirementKeys: string[] = [];
  const unresolvedRequirementKeys: string[] = [];

  for (const group of unmetRequirementGroups) {
    const isSatisfied = group.offeredCourses.some((course) =>
      selectedCourseCodes.has(course.courseCode)
    );

    if (isSatisfied) {
      satisfiedRequirementKeys.push(group.requirementKey);
      continue;
    }

    unresolvedRequirementKeys.push(group.requirementKey);
  }

  return {
    satisfiedRequirementKeys: dedupeWarnings(satisfiedRequirementKeys),
    unresolvedRequirementKeys: dedupeWarnings(unresolvedRequirementKeys),
  };
}

export function buildPlannerSummary(args: {
  saved: boolean;
  satisfiedRequirementKeys: string[];
  selectedSections: TermScheduleSection[];
  term: TermDescriptor;
  unresolvedRequirementKeys: string[];
  warnings: string[];
}) {
  if (!args.saved) {
    return [
      `No schedule was saved for ${args.term.name} (${args.term.code}).`,
      args.unresolvedRequirementKeys.length > 0
        ? `${args.unresolvedRequirementKeys.length} unmet requirement group${args.unresolvedRequirementKeys.length === 1 ? "" : "s"} remain unresolved.`
        : "",
      args.warnings.length > 0 ? args.warnings[0] : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `Saved ${args.selectedSections.length} section${args.selectedSections.length === 1 ? "" : "s"} for ${args.term.name} (${args.term.code}).`,
    args.satisfiedRequirementKeys.length > 0
      ? `${args.satisfiedRequirementKeys.length} unmet requirement group${args.satisfiedRequirementKeys.length === 1 ? "" : "s"} are now covered.`
      : "",
    args.unresolvedRequirementKeys.length > 0
      ? `${args.unresolvedRequirementKeys.length} unmet group${args.unresolvedRequirementKeys.length === 1 ? "" : "s"} remain unresolved.`
      : "No unmet requirement groups remain from the executor target set.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildNoSaveResult(args: {
  satisfiedRequirementKeys?: string[];
  studentMessage: string;
  term: TermDescriptor;
  termCode: string;
  toolTrace?: PlannerExecutionResult["toolTrace"];
  unresolvedRequirementKeys?: string[];
  warnings?: string[];
}): PlannerExecutionResult {
  const warnings = dedupeWarnings(args.warnings ?? []);
  const satisfiedRequirementKeys = args.satisfiedRequirementKeys ?? [];
  const unresolvedRequirementKeys = args.unresolvedRequirementKeys ?? [];

  return {
    termCode: args.termCode,
    saved: false,
    summary: buildPlannerSummary({
      term: args.term,
      saved: false,
      selectedSections: [],
      satisfiedRequirementKeys,
      unresolvedRequirementKeys,
      warnings,
    }),
    studentMessage: args.studentMessage,
    selectedSections: [],
    satisfiedRequirementKeys,
    unresolvedRequirementKeys,
    warnings,
    toolTrace: args.toolTrace,
  };
}
