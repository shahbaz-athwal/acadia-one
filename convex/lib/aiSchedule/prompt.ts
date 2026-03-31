import type {
  ExecutorPlannerOptions,
  RequirementPlanningSnapshot,
  TermDescriptor,
  TermScheduleSection,
} from "./types";

function joinValues(values: string[]) {
  return values.length > 0 ? values.join(", ") : "(none)";
}

function formatCourseLine(course: { courseCode: string; courseTitle: string }) {
  return `- ${course.courseCode}: ${course.courseTitle}`;
}

function formatScheduleSection(section: TermScheduleSection) {
  const days =
    section.daysOfWeek.length > 0 ? section.daysOfWeek.join("/") : "TBD days";

  return `- ${section.courseCode} ${section.sectionCode} | ${days} ${section.classStartTime}-${section.classEndTime} | ${section.professorName}`;
}

export function buildPlanningPrompt(args: {
  instructions?: string;
  plannerOptions: ExecutorPlannerOptions;
  programCode: string;
  programTitle: string;
  snapshot: RequirementPlanningSnapshot;
  term: TermDescriptor;
}) {
  const completedCoursesBlock =
    args.snapshot.completedCourses.length > 0
      ? args.snapshot.completedCourses.map(formatCourseLine).join("\n")
      : "- (none)";
  const inProgressCoursesBlock =
    args.snapshot.inProgressCourses.length > 0
      ? args.snapshot.inProgressCourses.map(formatCourseLine).join("\n")
      : "- (none)";
  const currentScheduleBlock =
    args.snapshot.currentTermSchedule.length > 0
      ? args.snapshot.currentTermSchedule
          .map((section) => formatScheduleSection(section))
          .join("\n")
      : "- (none)";
  const unmetProgressBlock =
    args.snapshot.unmetRequirementGroups.length > 0
      ? args.snapshot.unmetRequirementGroups
          .map((group) =>
            [
              `Requirement Key: ${group.requirementKey}`,
              `Requirement: ${group.requirementLabel}`,
              `Requirement Status: ${group.requirementCompletionStatus ?? "(unknown)"}`,
              `Subrequirement: ${group.subrequirementLabel}`,
              `Subrequirement Status: ${group.subrequirementCompletionStatus ?? "(unknown)"}`,
              `Group: ${group.groupLabel}`,
              `Group Status: ${group.groupCompletionStatus ?? "(unknown)"}`,
              `Resolution Type: ${group.groupType}`,
              "Available Courses This Term:",
              group.offeredCourses.length > 0
                ? group.offeredCourses.map(formatCourseLine).join("\n")
                : "- No available course for this term",
            ].join("\n")
          )
          .join("\n\n")
      : "(none)";

  const system = [
    "You are a term schedule planning executor.",
    `Plan only for termCode ${args.term.code}.`,
    "The unmet requirement snapshot is already computed in code.",
    "Do not reinterpret completed, in-progress, or unmet requirement satisfaction on your own.",
    `Target ${args.plannerOptions.targetCourseCount} courses unless the available offerings or constraints make that impossible.`,
    "Choose sections only from courses listed under unmet progress.",
    "Respect the student instructions exactly.",
    "Use the provided tools to search sections and verify conflicts.",
    "Search courses before selecting sections.",
    "Run detect_conflicts on the exact final candidate section ids before saving.",
    "After detect_conflicts reports no invalid ids and no conflicts for that exact section set, stop calling tools and return the final object.",
    "The selected term schedule will be replaced in code after you return the final object, so do not preserve old sections unless you intentionally choose them again.",
    "Your final response must be a structured object that matches the requested schema.",
    "Every selected section must include its own short summary explaining why that course fits.",
  ].join("\n");

  const prompt = [
    "Student Context",
    `Degree: ${args.programTitle} (${args.programCode})`,
    `Selected term: ${args.term.name} (${args.term.code})`,
    `Custom instructions: ${args.instructions?.trim() || "(none)"}`,
    `Target course count: ${args.plannerOptions.targetCourseCount}`,
    `In-progress counts as satisfied in planning: ${args.snapshot.treatInProgressAsSatisfied ? "yes" : "no"}`,
    "",
    "Completed Courses",
    completedCoursesBlock,
    "",
    "In-Progress Courses",
    inProgressCoursesBlock,
    "",
    "Current Saved Schedule For Selected Term",
    currentScheduleBlock,
    "",
    "Unmet Progress",
    unmetProgressBlock,
    "",
    "Warnings",
    joinValues(args.snapshot.warnings),
    "",
    "Tool usage requirements",
    "1. Search sections for courses shown under unmet progress.",
    "2. Choose sections that satisfy the most unmet groups while honoring the student instructions.",
    "3. Detect conflicts on the exact final candidate section ids.",
    "4. After the final candidate set is conflict-free, return the final object immediately.",
    "5. In the final object, explain what was scheduled and what still remains unresolved.",
    "6. For each selected section, include a brief user-facing summary specific to that course or section.",
  ].join("\n");

  return { system, prompt };
}
