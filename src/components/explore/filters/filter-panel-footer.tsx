import { UserIcon } from "lucide-react";
import { ThemeToggle } from "@/components/explore/filters/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useExploreFilters } from "@/hooks/use-explore-filters";
import { SEARCH_DEFAULTS } from "@/routes/explore";

export function FilterPanelFooter() {
  const { filters, setFilters } = useExploreFilters();
  const hasFilters =
    filters.termCodes.length > 0 ||
    filters.departmentPrefixes.length > 0 ||
    filters.professorExternalIds.length > 0 ||
    filters.days.length > 0 ||
    filters.academicLevels.length > 0 ||
    filters.timeStart !== SEARCH_DEFAULTS.ts ||
    filters.timeEnd !== SEARCH_DEFAULTS.te;

  return (
    <div className="flex flex-col gap-2 px-2">
      {hasFilters && (
        <Button
          className="w-full"
          onClick={() =>
            setFilters({
              termCodes: [],
              departmentPrefixes: [],
              professorExternalIds: [],
              days: [],
              academicLevels: [],
              timeStart: SEARCH_DEFAULTS.ts,
              timeEnd: SEARCH_DEFAULTS.te,
            })
          }
          size="sm"
          variant="secondary"
        >
          Clear filters
        </Button>
      )}

      <div className="flex items-center justify-between border-t pt-3">
        <Avatar>
          <AvatarFallback>
            <UserIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
        <ThemeToggle />
      </div>
    </div>
  );
}
