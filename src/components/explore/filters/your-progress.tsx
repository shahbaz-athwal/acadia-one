import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { userDataQuery } from "@/queries/explore";

type TreeLevel = "requirement" | "subrequirement" | "group" | "course";

interface ProgramEvaluationData {
  code: string;
  title: string;
  requirements: RequirementData[];
}

interface RequirementData {
  id: string;
  code: string;
  subrequirements: SubrequirementData[];
}

interface SubrequirementData {
  id: string;
  code: string;
  groups: GroupData[];
}

interface GroupData {
  id: string;
  courses: CourseData[];
}

interface CourseData {
  id: string;
  code: string;
}

interface ProgressTreeNode {
  id: string;
  level: TreeLevel;
  label: string;
  children: ProgressTreeNode[];
}

type ExpansionConfig =
  | {
      collapsedLevelsByDefault: ReadonlySet<TreeLevel>;
      persistence: "memory";
    }
  | {
      collapsedLevelsByDefault: ReadonlySet<TreeLevel>;
      persistence: "localStorage";
      storageKey: string;
    };

interface ExpansionState {
  userExpanded: Set<string>;
  userCollapsed: Set<string>;
}

const EXPANSION_CONFIG: ExpansionConfig = {
  // Keep this empty for now: all levels expanded by default.
  collapsedLevelsByDefault: new Set<TreeLevel>(),
  persistence: "localStorage",
  storageKey: "dryft.progressTree.expansionState.v1",
};

function createEmptyExpansionState(): ExpansionState {
  return {
    userExpanded: new Set<string>(),
    userCollapsed: new Set<string>(),
  };
}

function loadExpansionStateFromStorage(
  config: ExpansionConfig
): ExpansionState {
  if (config.persistence !== "localStorage") {
    return createEmptyExpansionState();
  }

  if (typeof window === "undefined") {
    return createEmptyExpansionState();
  }

  try {
    const raw = window.localStorage.getItem(config.storageKey);
    if (!raw) {
      return createEmptyExpansionState();
    }

    const parsed = JSON.parse(raw) as {
      userExpanded?: unknown;
      userCollapsed?: unknown;
    };

    const expanded = Array.isArray(parsed.userExpanded)
      ? parsed.userExpanded.filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [];
    const collapsed = Array.isArray(parsed.userCollapsed)
      ? parsed.userCollapsed.filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [];

    return {
      userExpanded: new Set(expanded),
      userCollapsed: new Set(collapsed),
    };
  } catch {
    return createEmptyExpansionState();
  }
}

function saveExpansionStateToStorage(
  config: ExpansionConfig,
  state: ExpansionState
) {
  if (config.persistence !== "localStorage") {
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      config.storageKey,
      JSON.stringify({
        userExpanded: [...state.userExpanded],
        userCollapsed: [...state.userCollapsed],
      })
    );
  } catch {
    // Ignore storage errors so tree interaction still works.
  }
}

function buildProgressTree(
  programEvaluation: ProgramEvaluationData | null
): ProgressTreeNode[] {
  if (!programEvaluation) {
    return [];
  }

  return programEvaluation.requirements.map((requirement): ProgressTreeNode => {
    const requirementId = `req:${requirement.id}`;
    return {
      id: requirementId,
      level: "requirement",
      label: requirement.code,
      children: requirement.subrequirements.map(
        (subrequirement): ProgressTreeNode => {
          const subId = `sub:${requirement.id}:${subrequirement.id}`;
          return {
            id: subId,
            level: "subrequirement",
            label: subrequirement.code,
            children: subrequirement.groups.map((group): ProgressTreeNode => {
              const groupId = `grp:${requirement.id}:${subrequirement.id}:${group.id}`;
              return {
                id: groupId,
                level: "group",
                label: group.id,
                children: group.courses.map(
                  (course): ProgressTreeNode => ({
                    id: `crs:${requirement.id}:${subrequirement.id}:${group.id}:${course.id}`,
                    level: "course",
                    label: course.code,
                    children: [],
                  })
                ),
              };
            }),
          };
        }
      ),
    };
  });
}

function isExpanded(
  node: ProgressTreeNode,
  state: ExpansionState,
  config: ExpansionConfig
) {
  if (node.children.length === 0) {
    return false;
  }
  if (state.userCollapsed.has(node.id)) {
    return false;
  }
  if (state.userExpanded.has(node.id)) {
    return true;
  }
  return !config.collapsedLevelsByDefault.has(node.level);
}

interface ProgressTreeBranchProps {
  nodes: ProgressTreeNode[];
  depth: number;
  expansionState: ExpansionState;
  expansionConfig: ExpansionConfig;
  onToggle: (node: ProgressTreeNode) => void;
}

function ProgressTreeBranch({
  nodes,
  depth,
  expansionState,
  expansionConfig,
  onToggle,
}: ProgressTreeBranchProps) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const expanded = isExpanded(node, expansionState, expansionConfig);
        let icon: React.ReactNode;
        if (!hasChildren) {
          icon = <span className="size-3.5 shrink-0" />;
        } else if (expanded) {
          icon = (
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          );
        } else {
          icon = (
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
          );
        }

        return (
          <li key={node.id}>
            <button
              className="flex w-full items-center gap-1 rounded-sm py-1 text-left text-xs hover:bg-accent/60"
              onClick={() => hasChildren && onToggle(node)}
              style={{ paddingLeft: depth * 14 }}
              type="button"
            >
              {icon}
              <span className="font-mono text-[11px]">{node.label}</span>
            </button>

            {hasChildren && expanded ? (
              <ProgressTreeBranch
                depth={depth + 1}
                expansionConfig={expansionConfig}
                expansionState={expansionState}
                nodes={node.children}
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
  const { data: userData } = useSuspenseQuery(
    userDataQuery(sessionId, tokenHash)
  );

  const [expansionState, setExpansionState] = useState<ExpansionState>(() =>
    loadExpansionStateFromStorage(EXPANSION_CONFIG)
  );

  const treeNodes = useMemo(
    () =>
      buildProgressTree(
        (userData?.programEvaluation as ProgramEvaluationData | undefined) ??
          null
      ),
    [userData?.programEvaluation]
  );
  const programEvaluation = userData?.programEvaluation as
    | ProgramEvaluationData
    | undefined;
  const degreeTitle = [programEvaluation?.title, programEvaluation?.code]
    .filter((value): value is string => !!value)
    .join(" • ");

  const handleToggle = (node: ProgressTreeNode) => {
    setExpansionState((previousState) => {
      const nextState: ExpansionState = {
        userExpanded: new Set(previousState.userExpanded),
        userCollapsed: new Set(previousState.userCollapsed),
      };

      if (isExpanded(node, previousState, EXPANSION_CONFIG)) {
        nextState.userExpanded.delete(node.id);
        nextState.userCollapsed.add(node.id);
      } else {
        nextState.userCollapsed.delete(node.id);
        nextState.userExpanded.add(node.id);
      }

      return nextState;
    });
  };

  useEffect(() => {
    saveExpansionStateToStorage(EXPANSION_CONFIG, expansionState);
  }, [expansionState]);

  if (treeNodes.length === 0) {
    // Todo: empty state
    return (
      <div className="p-3 text-muted-foreground text-xs">
        No program evaluation data found.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {degreeTitle ? (
        <p className="px-1 font-medium text-foreground text-xs">{degreeTitle}</p>
      ) : null}
      <ProgressTreeBranch
        depth={0}
        expansionConfig={EXPANSION_CONFIG}
        expansionState={expansionState}
        nodes={treeNodes}
        onToggle={handleToggle}
      />
    </div>
  );
}

export default YourProgress;
