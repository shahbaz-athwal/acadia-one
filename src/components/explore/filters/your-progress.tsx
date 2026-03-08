import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TruncatedTooltipText } from "@/components/ui/truncated-tooltip-text";
import { useAuth } from "@/hooks/use-auth";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { userDataQuery } from "@/queries/explore";
import type { Doc } from "../../../../convex/_generated/dataModel";

type TreeLevel = "requirement" | "subrequirement" | "group" | "course";

type ProgramEvaluationData = Doc<"acadiaUserData">["programEvaluation"];
type RequirementData = ProgramEvaluationData["requirements"][number];
type SubrequirementData = RequirementData["subrequirements"][number];
type GroupData = SubrequirementData["groups"][number];
type CourseData = GroupData["courses"][number];

interface ProgressTreeNode {
  id: string;
  level: TreeLevel;
  label: string;
  description?: string;
  directive?: string;
  rsgKey?: string;
  children: ProgressTreeNode[];
}

interface ExpansionState {
  userExpanded: Set<string>;
  userCollapsed: Set<string>;
}

interface PersistedExpansionState {
  userExpanded?: unknown;
  userCollapsed?: unknown;
}

const NODE_ID_PREFIX: Record<TreeLevel, string> = {
  requirement: "req",
  subrequirement: "sub",
  group: "grp",
  course: "crs",
};
const INDENT_PER_LEVEL_PX = 14;
const EXPANSION_STORAGE_KEY = "dryft.progressTree.expansionState.v1";
const COLLAPSED_LEVELS_BY_DEFAULT: ReadonlySet<TreeLevel> =
  new Set<TreeLevel>();
const LEVELS_WITH_DIRECTIVE: ReadonlySet<TreeLevel> = new Set<TreeLevel>([
  "requirement",
  "subrequirement",
]);
const LEVELS_WITH_TRUNCATED_TITLE: ReadonlySet<TreeLevel> = new Set<TreeLevel>([
  "requirement",
  "group",
  "course",
]);

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

function joinNonEmpty(
  values: Array<string | null | undefined>,
  separator: string
): string {
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
      })
    );
  } catch {
    // Ignore storage errors so tree interaction still works.
  }
}

function mapCourseNode(
  requirementId: string,
  subrequirementId: string,
  groupId: string,
  course: CourseData
): ProgressTreeNode {
  const label =
    joinNonEmpty([course.code, course.title], " - ") || `Course ${course.id}`;
  return {
    id: buildNodeId("course", [
      requirementId,
      subrequirementId,
      groupId,
      course.id,
    ]),
    level: "course",
    label,
    children: [],
  };
}

function mapGroupNode(
  requirementCode: string,
  requirementId: string,
  subrequirementId: string,
  group: GroupData
): ProgressTreeNode {
  const label =
    toOptionalText(group.displayText) ??
    toOptionalText(group.directive) ??
    `Group ${group.id}`;
  return {
    id: buildNodeId("group", [requirementId, subrequirementId, group.id]),
    level: "group",
    label,
    rsgKey: `${requirementCode}:${subrequirementId}:${group.id}`,
    children: group.courses.map((course) =>
      mapCourseNode(requirementId, subrequirementId, group.id, course)
    ),
  };
}

function mapSubrequirementNode(
  requirementCode: string,
  requirementId: string,
  subrequirement: SubrequirementData
): ProgressTreeNode {
  const groupNodes = subrequirement.groups.map((group) =>
    mapGroupNode(requirementCode, requirementId, subrequirement.id, group)
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
    directive: isFlattened
      ? undefined
      : toOptionalText(subrequirement.directive),
    rsgKey: isFlattened ? groupNodes[0]?.rsgKey : undefined,
    children: isFlattened ? groupNodes[0].children : groupNodes,
  };
}

function mapRequirementNode(requirement: RequirementData): ProgressTreeNode {
  return {
    id: buildNodeId("requirement", [requirement.id]),
    level: "requirement",
    label: requirement.description,
    description: requirement.description,
    directive: toOptionalText(requirement.directive),
    children: requirement.subrequirements.map((subrequirement) =>
      mapSubrequirementNode(requirement.code, requirement.id, subrequirement)
    ),
  };
}

function buildProgressTree(
  programEvaluation: ProgramEvaluationData | null
): ProgressTreeNode[] {
  if (!programEvaluation) {
    return [];
  }

  return programEvaluation.requirements.map(mapRequirementNode);
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

function getExpansionIcon(hasChildren: boolean, expanded: boolean): ReactNode {
  if (!hasChildren) {
    return <span className="size-3.5 shrink-0" />;
  }
  if (expanded) {
    return (
      <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
    );
  }
  return (
    <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
  );
}

function renderLabel(node: ProgressTreeNode): ReactNode {
  if (LEVELS_WITH_TRUNCATED_TITLE.has(node.level)) {
    return (
      <TruncatedTooltipText
        containerClassName="min-w-0 flex-1"
        text={node.label}
      />
    );
  }
  return <span className="truncate">{node.label}</span>;
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
      <TooltipPopup
        align="end"
        className="max-w-72 whitespace-normal leading-snug"
      >
        {directive}
      </TooltipPopup>
    </Tooltip>
  );
}

function renderSearchChip(
  rsgKey: string | undefined,
  activeRsgKey: string | undefined,
  onSearchToggle: (rsgKey: string) => void
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

interface ProgressTreeBranchProps {
  nodes: ProgressTreeNode[];
  depth: number;
  expansionState: ExpansionState;
  activeRsgKey?: string;
  onSearchToggle: (rsgKey: string) => void;
  onToggle: (node: ProgressTreeNode) => void;
}

function ProgressTreeBranch({
  nodes,
  depth,
  activeRsgKey,
  expansionState,
  onSearchToggle,
  onToggle,
}: ProgressTreeBranchProps) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const expanded = isExpanded(node, expansionState);
        const showDirective = LEVELS_WITH_DIRECTIVE.has(node.level);

        return (
          <li key={node.id}>
            <div
              className="flex items-center gap-1 rounded-sm py-1 hover:bg-accent/60"
              style={{ paddingLeft: depth * INDENT_PER_LEVEL_PX }}
            >
              <button
                aria-expanded={hasChildren ? expanded : undefined}
                className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm sm:text-xs"
                onClick={() => {
                  if (!hasChildren) {
                    return;
                  }
                  onToggle(node);
                }}
                type="button"
              >
                {getExpansionIcon(hasChildren, expanded)}
                {renderLabel(node)}
              </button>
              {node.rsgKey || showDirective ? (
                <div className="flex shrink-0 items-center gap-1 pr-1">
                  {renderSearchChip(node.rsgKey, activeRsgKey, onSearchToggle)}
                  {showDirective ? renderDirective(node.directive) : null}
                </div>
              ) : null}
            </div>

            {hasChildren && expanded ? (
              <ProgressTreeBranch
                activeRsgKey={activeRsgKey}
                depth={depth + 1}
                expansionState={expansionState}
                nodes={node.children}
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
  const { filters, setRsgKeys } = useExploreFilters();
  const { data: userData } = useSuspenseQuery(
    userDataQuery(sessionId, tokenHash)
  );

  const [expansionState, setExpansionState] = useState<ExpansionState>(
    loadExpansionStateFromStorage
  );
  const programEvaluation = userData?.programEvaluation ?? null;

  const treeNodes = useMemo(
    () => buildProgressTree(programEvaluation),
    [programEvaluation]
  );
  const degreeTitle = joinNonEmpty(
    [programEvaluation?.title, programEvaluation?.code],
    " • "
  );
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
    [activeRsgKey, setRsgKeys]
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
        {degreeTitle ? (
          <p className="px-1 font-medium text-foreground text-sm sm:text-xs">
            {degreeTitle}
          </p>
        ) : null}
        <ProgressTreeBranch
          activeRsgKey={activeRsgKey}
          depth={0}
          expansionState={expansionState}
          nodes={treeNodes}
          onSearchToggle={handleSearchToggle}
          onToggle={handleToggle}
        />
      </div>
    </TooltipProvider>
  );
}

export default YourProgress;
