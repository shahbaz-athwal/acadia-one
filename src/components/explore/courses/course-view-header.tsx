import { BookOpenIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useExploreFilters } from "@/hooks/use-explore-filters";

export function CourseViewHeader() {
  const { searchQuery, setSearchQuery } = useExploreFilters();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSetSearch = useDebounceCallback(setSearchQuery, 300);

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

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <CardTitle className="flex shrink-0 items-center gap-1.5 font-semibold text-base">
        <BookOpenIcon className="size-4" />
        Courses
      </CardTitle>
      <div className="relative max-w-56">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
