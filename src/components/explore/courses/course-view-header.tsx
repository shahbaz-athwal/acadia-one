import { useSuspenseQuery } from "@tanstack/react-query";
import { BookOpenIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { Badge } from "@/components/ui/badge";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { userDataQuery } from "@/queries/explore";
import type { Doc } from "../../../../convex/_generated/dataModel";

type ProgramEvaluationData = Doc<"acadiaUserData">["programEvaluation"];

function toOptionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function buildRsgLabelByKey(programEvaluation: ProgramEvaluationData | null): Map<string, string> {
  const labels = new Map<string, string>();

  if (!programEvaluation) {
    return labels;
  }

  for (const requirement of programEvaluation.requirements) {
    for (const subrequirement of requirement.subrequirements) {
      const groups = subrequirement.groups;
      const subrequirementLabel =
        toOptionalText(subrequirement.code) ??
        toOptionalText(subrequirement.displayText) ??
        `Subrequirement ${subrequirement.id}`;

      if (groups.length === 1) {
        const group = groups[0];
        labels.set(`${requirement.code}:${subrequirement.id}:${group.id}`, subrequirementLabel);
        continue;
      }

      for (const group of groups) {
        const groupLabel =
          toOptionalText(group.displayText) ??
          toOptionalText(group.directive) ??
          `Group ${group.id}`;
        labels.set(`${requirement.code}:${subrequirement.id}:${group.id}`, groupLabel);
      }
    }
  }

  return labels;
}

export function CourseViewHeader() {
  const { isAuthenticated, sessionId, tokenHash } = useAuth();
  const {
    filters,
    searchQuery,
    selectedCourseCode,
    setRsgKeys,
    setSearchQuery,
    setSelectedCourseCode,
  } = useExploreFilters();
  const { data: userData } = useSuspenseQuery(userDataQuery(sessionId, tokenHash));
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRsgKey = filters.rsgKeys[0];
  const rsgLabelByKey = useMemo(
    () => buildRsgLabelByKey(isAuthenticated ? (userData?.programEvaluation ?? null) : null),
    [isAuthenticated, userData?.programEvaluation],
  );
  const activeRsgLabel = activeRsgKey ? (rsgLabelByKey.get(activeRsgKey) ?? "Group filter") : null;

  const debouncedSetSearch = useDebounceCallback(setSearchQuery, 500);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleChange = (value: string) => {
    setLocalQuery(value);
    debouncedSetSearch(value);
  };

  const handleClear = () => {
    setLocalQuery("");
    setSearchQuery("");
    inputRef.current?.focus();
  };

  const handleClearCourseFilter = () => {
    setSelectedCourseCode("");
  };

  const handleClearRsgFilter = () => {
    setRsgKeys([]);
  };

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CardTitle className="flex shrink-0 items-center gap-1.5 font-semibold text-base">
          <BookOpenIcon className="size-4" />
          Courses
        </CardTitle>
        {activeRsgLabel ? (
          <Badge
            aria-label={`Clear group filter for ${activeRsgLabel}`}
            className="max-w-40 gap-1 px-2"
            onClick={handleClearRsgFilter}
            render={<button type="button" />}
            size="sm"
            title={activeRsgLabel}
            variant="info"
          >
            <span className="truncate">{activeRsgLabel}</span>
            <XIcon className="size-3" />
          </Badge>
        ) : null}
        {selectedCourseCode ? (
          <Badge
            aria-label={`Clear course filter for ${selectedCourseCode}`}
            className="max-w-36 gap-1 px-2"
            onClick={handleClearCourseFilter}
            render={<button type="button" />}
            size="sm"
            variant="info"
          >
            <span className="truncate">{selectedCourseCode}</span>
            <XIcon className="size-3" />
          </Badge>
        ) : null}
      </div>
      <div className="relative max-w-56">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="rounded-md **:data-[slot=input]:pr-7 **:data-[slot=input]:pl-7"
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search courses..."
          ref={inputRef}
          size="sm"
          type="search"
          value={localQuery}
        />
        {localQuery && (
          <button
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
            type="button"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
