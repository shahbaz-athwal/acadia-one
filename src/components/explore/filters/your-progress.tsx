import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildCourseStatusByCode,
  COURSE_STATUS_META,
  type CoursePlanningStatus,
} from "@/components/explore/courses/course-status";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TruncatedTooltipText } from "@/components/ui/truncated-tooltip-text";
import { useAuth } from "@/hooks/use-auth";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { cn } from "@/lib/utils";
import { progressSearchCoursesQuery, userDataQuery } from "@/queries/explore";
import type { Doc } from "../../../../convex/_generated/dataModel";

type TreeLevel = "requirement" | "subrequirement" | "group" | "course";

type ProgramEvaluationData = Doc<"acadiaUserData">["programEvaluation"];
type RequirementData = ProgramEvaluationData["requirements"][number];
type SubrequirementData = RequirementData["subrequirements"][number];
type GroupData = SubrequirementData["groups"][number];
type CourseData = GroupData["courses"][number];

interface SearchGroupCourseData {
  code: string;
  title?: string;
}

interface ProgressTreeNode {
  children: ProgressTreeNode[];
  completionStatus?: string | null;
  courseCode?: string;
  description?: string;
  directive?: string;
  id: string;
  label: string;
  level: TreeLevel;
  rsgKey?: string;
  status?: CoursePlanningStatus | null;
}

interface ExpansionState {
  userCollapsed: Set<string>;
  userExpanded: Set<string>;
}

interface PersistedExpansionState {
  userCollapsed?: unknown;
  userExpanded?: unknown;
}

const NODE_ID_PREFIX: Record<TreeLevel, string> = {
  requirement: "req",
  subrequirement: "sub",
  group: "grp",
  course: "crs",
};
const INDENT_PER_LEVEL_PX = 14;
const EXPANSION_STORAGE_KEY = "dryft.progressTree.expansionState.v1";
const COLLAPSED_LEVELS_BY_DEFAULT: ReadonlySet<TreeLevel> = new Set<TreeLevel>([
  "subrequirement",
  "group",
]);
const LEVELS_WITH_DIRECTIVE: ReadonlySet<TreeLevel> = new Set<TreeLevel>([
  "requirement",
  "subrequirement",
]);
const LEVELS_WITH_TRUNCATED_TITLE: ReadonlySet<TreeLevel> = new Set<TreeLevel>([
  "requirement",
  "group",
  "course",
]);
interface CompletionStatusMeta {
  label: string;
  variant: ComponentProps<typeof Badge>["variant"];
}

const COMPLETION_STATUS_META: Record<string, CompletionStatusMeta> = {
  Completed: {
    label: "Completed",
    variant: "success",
  },
  PartiallyCompleted: {
    label: "Partially completed",
    variant: "warning",
  },
  NotCompleted: {
    label: "Not completed",
    variant: "outline",
  },
};

function createEmptyExpansionState(): ExpansionState {
  return {
    userExpanded: new Set<string>(),
    userCollapsed: new Set<string>(),
  };
}

function toOptionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function toReadableCompletionStatus(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  return trimmed.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function getCompletionStatusMeta(value: string | null | undefined): CompletionStatusMeta | null {
  const normalizedValue = toOptionalText(value);
  if (!normalizedValue) {
    return null;
  }

  const knownMeta = COMPLETION_STATUS_META[normalizedValue];
  if (knownMeta) {
    return knownMeta;
  }

  return {
    label: toReadableCompletionStatus(normalizedValue) || normalizedValue,
    variant: "outline",
  };
}

function joinNonEmpty(values: Array<string | null | undefined>, separator: string): string {
  return values
    .map((value) => toOptionalText(value))
    .filter((value): value is string => value !== undefined)
    .join(separator);
}

function buildNodeId(level: TreeLevel, segments: string[]): string {
  return [NODE_ID_PREFIX[level], ...segments].join(":");
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function loadExpansionStateFromStorage(): ExpansionState {
  if (typeof window === "undefined") {
    return createEmptyExpansionState();
  }

  try {
    const raw = window.localStorage.getItem(EXPANSION_STORAGE_KEY);
    if (!raw) {
      return createEmptyExpansionState();
    }

    const parsed = JSON.parse(raw) as PersistedExpansionState;
    return {
      userExpanded: new Set(toStringArray(parsed.userExpanded)),
      userCollapsed: new Set(toStringArray(parsed.userCollapsed)),
    };
  } catch {
    return createEmptyExpansionState();
  }
}

function saveExpansionStateToStorage(state: ExpansionState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      EXPANSION_STORAGE_KEY,
      JSON.stringify({
        userExpanded: [...state.userExpanded],
        userCollapsed: [...state.userCollapsed],
      }),
    );
  } catch {
    // Ignore storage errors so tree interaction still works.
  }
}

function mapCourseNode(
  requirementId: string,
  subrequirementId: string,
  groupId: string,
  course: CourseData,
  courseStatusByCode: ReadonlyMap<string, CoursePlanningStatus>,
): ProgressTreeNode {
  const label = joinNonEmpty([course.code, course.title], " - ") || `Course ${course.id}`;
  const courseCode = course.code;
  return {
    id: buildNodeId("course", [requirementId, subrequirementId, groupId, course.id]),
    level: "course",
    label,
    courseCode,
    status: courseStatusByCode.get(courseCode) ?? null,
    children: [],
  };
}

function mapSearchCourseNode(
  requirementId: string,
  subrequirementId: string,
  groupId: string,
  course: SearchGroupCourseData,
  courseStatusByCode: ReadonlyMap<string, CoursePlanningStatus>,
): ProgressTreeNode {
  const courseCode = course.code;
  const label = joinNonEmpty([courseCode, course.title], " - ") || `Course ${courseCode}`;
  return {
    id: buildNodeId("course", [requirementId, subrequirementId, groupId, `search:${courseCode}`]),
    level: "course",
    label,
    courseCode,
    status: courseStatusByCode.get(courseCode) ?? null,
    children: [],
  };
}

function mapGroupNode(
  requirementCode: string,
  requirementId: string,
  subrequirementId: string,
  group: GroupData,
  courseStatusByCode: ReadonlyMap<string, CoursePlanningStatus>,
  searchGroupCoursesByKey: ReadonlyMap<string, SearchGroupCourseData[]>,
): ProgressTreeNode {
  const label =
    toOptionalText(group.displayText) ?? toOptionalText(group.directive) ?? `Group ${group.id}`;
  const rsgKey = `${requirementCode}:${subrequirementId}:${group.id}`;
  const searchGroupCourses = (searchGroupCoursesByKey.get(rsgKey) ?? []).filter((course) =>
    courseStatusByCode.has(course.code),
  );

  return {
    id: buildNodeId("group", [requirementId, subrequirementId, group.id]),
    level: "group",
    label,
    completionStatus: group.completionStatus,
    rsgKey,
    children:
      group.courses.length > 0
        ? group.courses.map((course) =>
            mapCourseNode(requirementId, subrequirementId, group.id, course, courseStatusByCode),
          )
        : searchGroupCourses.map((course) =>
            mapSearchCourseNode(
              requirementId,
              subrequirementId,
              group.id,
              course,
              courseStatusByCode,
            ),
          ),
  };
}

function mapSubrequirementNode(
  requirementCode: string,
  requirementId: string,
  subrequirement: SubrequirementData,
  courseStatusByCode: ReadonlyMap<string, CoursePlanningStatus>,
  searchGroupCoursesByKey: ReadonlyMap<string, SearchGroupCourseData[]>,
): ProgressTreeNode {
  const groupNodes = subrequirement.groups.map((group) =>
    mapGroupNode(
      requirementCode,
      requirementId,
      subrequirement.id,
      group,
      courseStatusByCode,
      searchGroupCoursesByKey,
    ),
  );
  const isFlattened = groupNodes.length === 1;

  const label =
    toOptionalText(subrequirement.code) ??
    toOptionalText(subrequirement.displayText) ??
    `Subrequirement ${subrequirement.id}`;
  return {
    id: buildNodeId("subrequirement", [requirementId, subrequirement.id]),
    level: "subrequirement",
    label,
    completionStatus: subrequirement.completionStatus,
    directive: isFlattened ? undefined : toOptionalText(subrequirement.directive),
    rsgKey: isFlattened ? groupNodes[0]?.rsgKey : undefined,
    children: isFlattened ? groupNodes[0].children : groupNodes,
  };
}

function mapRequirementNode(
  requirement: RequirementData,
  courseStatusByCode: ReadonlyMap<string, CoursePlanningStatus>,
  searchGroupCoursesByKey: ReadonlyMap<string, SearchGroupCourseData[]>,
): ProgressTreeNode {
  return {
    id: buildNodeId("requirement", [requirement.id]),
    level: "requirement",
    label: requirement.description,
    completionStatus: requirement.completionStatus,
    description: requirement.description,
    directive: toOptionalText(requirement.directive),
    children: requirement.subrequirements.map((subrequirement) =>
      mapSubrequirementNode(
        requirement.code,
        requirement.id,
        subrequirement,
        courseStatusByCode,
        searchGroupCoursesByKey,
      ),
    ),
  };
}

function buildProgressTree(
  programEvaluation: ProgramEvaluationData | null,
  courseStatusByCode: ReadonlyMap<string, CoursePlanningStatus>,
  searchGroupCoursesByKey: ReadonlyMap<string, SearchGroupCourseData[]>,
): ProgressTreeNode[] {
  if (!programEvaluation) {
    return [];
  }

  return programEvaluation.requirements.map((requirement) =>
    mapRequirementNode(requirement, courseStatusByCode, searchGroupCoursesByKey),
  );
}

function isExpanded(node: ProgressTreeNode, state: ExpansionState): boolean {
  if (node.children.length === 0) {
    return false;
  }
  if (state.userCollapsed.has(node.id)) {
    return false;
  }
  if (state.userExpanded.has(node.id)) {
    return true;
  }
  return !COLLAPSED_LEVELS_BY_DEFAULT.has(node.level);
}

function getLeadingSlot(node: ProgressTreeNode, expanded: boolean): ReactNode {
  const hasChildren = node.children.length > 0;
  if (!hasChildren) {
    if (node.level === "course" && node.status) {
      const statusMeta = COURSE_STATUS_META[node.status];
      const StatusIcon = statusMeta.icon;

      return (
        <span
          aria-label={statusMeta.label}
          className="inline-flex size-3.5 shrink-0 items-center justify-center"
          role="img"
          title={statusMeta.label}
        >
          <StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />
        </span>
      );
    }
    return <span className="size-3.5 shrink-0" />;
  }
  if (expanded) {
    return <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  return <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />;
}

function renderLabel(node: ProgressTreeNode, className?: string): ReactNode {
  if (LEVELS_WITH_TRUNCATED_TITLE.has(node.level)) {
    return (
      <TruncatedTooltipText
        className={className}
        containerClassName="min-w-0 flex-1"
        text={node.label}
      />
    );
  }
  return <span className={cn("truncate", className)}>{node.label}</span>;
}

function renderNodeContent(node: ProgressTreeNode, expanded: boolean): ReactNode {
  const statusMeta =
    node.level === "course" && node.status ? COURSE_STATUS_META[node.status] : null;

  if (node.level === "course") {
    return (
      <span className={cn("flex min-w-0 flex-1 items-center gap-1", statusMeta?.textClassName)}>
        {getLeadingSlot(node, expanded)}
        {renderLabel(node, statusMeta?.textClassName)}
      </span>
    );
  }

  return (
    <>
      {getLeadingSlot(node, expanded)}
      {renderLabel(node)}
    </>
  );
}

function renderDirective(directive: string | undefined): ReactNode {
  if (!directive) {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label="Directive"
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent/80"
            data-ignore-tree-toggle="true"
            role="img"
          >
            <InfoIcon className="size-3" />
          </span>
        }
      />
      <TooltipPopup align="end" className="max-w-72 whitespace-normal leading-snug">
        {directive}
      </TooltipPopup>
    </Tooltip>
  );
}

function renderSearchChip(
  rsgKey: string | undefined,
  activeRsgKey: string | undefined,
  onSearchToggle: (rsgKey: string) => void,
): ReactNode {
  if (!rsgKey) {
    return null;
  }

  const isActive = activeRsgKey === rsgKey;

  return (
    <Badge
      aria-pressed={isActive}
      className="px-1.5"
      data-ignore-tree-toggle="true"
      onClick={() => onSearchToggle(rsgKey)}
      render={<button type="button" />}
      size="sm"
      variant={isActive ? "info" : "outline"}
    >
      Search
    </Badge>
  );
}

function renderCompletionStatusBadge(node: ProgressTreeNode): ReactNode {
  if (node.level === "course") {
    return null;
  }

  const completionStatus = toOptionalText(node.completionStatus);
  if (completionStatus === "PartiallyCompleted") {
    return null;
  }
  const meta = getCompletionStatusMeta(completionStatus);
  if (!(completionStatus && meta)) {
    return null;
  }

  return (
    <Badge
      className="max-w-32"
      data-ignore-tree-toggle="true"
      size="sm"
      title={meta.label === completionStatus ? undefined : completionStatus}
      variant={meta.variant}
    >
      <span className="truncate">{meta.label}</span>
    </Badge>
  );
}

interface ProgressTreeBranchProps {
  activeCourseCode?: string;
  activeRsgKey?: string;
  depth: number;
  expansionState: ExpansionState;
  nodes: ProgressTreeNode[];
  onCourseToggle: (courseCode: string) => void;
  onSearchToggle: (rsgKey: string) => void;
  onToggle: (node: ProgressTreeNode) => void;
}

function ProgressTreeBranch({
  nodes,
  depth,
  activeCourseCode,
  activeRsgKey,
  expansionState,
  onCourseToggle,
  onSearchToggle,
  onToggle,
}: ProgressTreeBranchProps) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const expanded = isExpanded(node, expansionState);
        const isCourseActive = node.level === "course" && activeCourseCode === node.courseCode;
        const showDirective = LEVELS_WITH_DIRECTIVE.has(node.level);
        const completionStatusBadge = renderCompletionStatusBadge(node);

        return (
          <li key={node.id}>
            <div
              className={cn(
                "flex items-center gap-1 rounded-sm py-1 hover:bg-accent/60",
                isCourseActive && "bg-info/8 hover:bg-info/12",
              )}
              style={{ paddingLeft: depth * INDENT_PER_LEVEL_PX }}
            >
              <button
                aria-expanded={hasChildren ? expanded : undefined}
                aria-pressed={node.level === "course" ? isCourseActive : undefined}
                className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm sm:text-xs"
                onClick={() => {
                  if (!hasChildren && node.courseCode) {
                    onCourseToggle(node.courseCode);
                    return;
                  }
                  if (!hasChildren) {
                    return;
                  }
                  onToggle(node);
                }}
                type="button"
              >
                {renderNodeContent(node, expanded)}
              </button>
              {completionStatusBadge || node.rsgKey || showDirective ? (
                <div className="flex shrink-0 items-center gap-1.5 pr-1">
                  {completionStatusBadge}
                  {renderSearchChip(node.rsgKey, activeRsgKey, onSearchToggle)}
                  {showDirective ? renderDirective(node.directive) : null}
                </div>
              ) : null}
            </div>

            {hasChildren && expanded ? (
              <ProgressTreeBranch
                activeCourseCode={activeCourseCode}
                activeRsgKey={activeRsgKey}
                depth={depth + 1}
                expansionState={expansionState}
                nodes={node.children}
                onCourseToggle={onCourseToggle}
                onSearchToggle={onSearchToggle}
                onToggle={onToggle}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function YourProgress() {
  const { sessionId, tokenHash } = useAuth();
  const { filters, selectedCourseCode, setRsgKeys, setSelectedCourseCode } = useExploreFilters();
  const { data: userData } = useSuspenseQuery(userDataQuery(sessionId, tokenHash));
  const { data: progressSearchCourses } = useSuspenseQuery(
    progressSearchCoursesQuery(sessionId, tokenHash),
  );

  const [expansionState, setExpansionState] = useState<ExpansionState>(
    loadExpansionStateFromStorage,
  );
  const programEvaluation = userData?.programEvaluation ?? null;
  const courseStatusByCode = useMemo(() => buildCourseStatusByCode(userData), [userData]);
  const searchGroupCoursesByKey = useMemo(
    () => new Map(progressSearchCourses.map(({ key, courses }) => [key, courses] as const)),
    [progressSearchCourses],
  );

  const treeNodes = useMemo(
    () => buildProgressTree(programEvaluation, courseStatusByCode, searchGroupCoursesByKey),
    [courseStatusByCode, programEvaluation, searchGroupCoursesByKey],
  );
  const degreeTitle = joinNonEmpty([programEvaluation?.title, programEvaluation?.code], " • ");
  const activeRsgKey = filters.rsgKeys[0];

  const handleToggle = useCallback((node: ProgressTreeNode) => {
    setExpansionState((previousState) => {
      const userExpanded = new Set(previousState.userExpanded);
      const userCollapsed = new Set(previousState.userCollapsed);

      if (isExpanded(node, previousState)) {
        userExpanded.delete(node.id);
        userCollapsed.add(node.id);
      } else {
        userCollapsed.delete(node.id);
        userExpanded.add(node.id);
      }

      return {
        userExpanded,
        userCollapsed,
      };
    });
  }, []);

  const handleSearchToggle = useCallback(
    (rsgKey: string) => {
      setRsgKeys(activeRsgKey === rsgKey ? [] : [rsgKey]);
    },
    [activeRsgKey, setRsgKeys],
  );

  const handleCourseToggle = useCallback(
    (courseCode: string) => {
      setSelectedCourseCode(selectedCourseCode === courseCode ? "" : courseCode);
    },
    [selectedCourseCode, setSelectedCourseCode],
  );

  useEffect(() => {
    saveExpansionStateToStorage(expansionState);
  }, [expansionState]);

  if (treeNodes.length === 0) {
    return (
      <div className="p-3 text-muted-foreground text-sm sm:text-xs">
        No program evaluation data found.
      </div>
    );
  }

  return (
    <TooltipProvider delay={250}>
      <div className="space-y-2 p-2">
        {degreeTitle && (
          <p className="px-1 font-medium text-foreground text-sm sm:text-xs">{degreeTitle}</p>
        )}
        <ProgressTreeBranch
          activeCourseCode={selectedCourseCode}
          activeRsgKey={activeRsgKey}
          depth={0}
          expansionState={expansionState}
          nodes={treeNodes}
          onCourseToggle={handleCourseToggle}
          onSearchToggle={handleSearchToggle}
          onToggle={handleToggle}
        />
      </div>
    </TooltipProvider>
  );
}

export default YourProgress;
