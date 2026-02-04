"use client";

import { LayoutGrid, Search, Table } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sortOptions } from "@/features/explore/constants";
import {
  type ExploreView,
  useExploreQueryState,
} from "@/features/explore/query-state";

function ExploreToolbar() {
  const { state, setSearch, setSort, setView } = useExploreQueryState();
  const [searchValue, setSearchValue] = useState(state.search);
  const searchRef = useRef<HTMLInputElement>(null);

  const sortValue = useMemo(
    () => `${state.sort.key}:${state.sort.dir}`,
    [state.sort.dir, state.sort.key]
  );

  useEffect(() => {
    setSearchValue(state.search);
  }, [state.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchValue !== state.search) {
        setSearch(searchValue);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchValue, setSearch, state.search]);

  useEffect(() => {
    function handleSlash(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== "/") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const tagName = target.tagName?.toLowerCase();
      const isEditable =
        target.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select";
      if (isEditable) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }

    window.addEventListener("keydown", handleSlash);
    return () => window.removeEventListener("keydown", handleSlash);
  }, []);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-1 items-center gap-3">
        <InputGroup className="max-w-xl">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            onChange={(event) => {
              setSearchValue(event.target.value);
            }}
            placeholder="Search courses, professors, or departments"
            ref={searchRef}
            value={searchValue}
          />
          <InputGroupAddon align="inline-end">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          onValueChange={(next) => {
            const selected = sortOptions.find(
              (option) => option.value === next
            );
            if (selected) {
              setSort(selected.sort);
            }
          }}
          value={sortValue}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          onValueChange={(next: ExploreView[]) => {
            const [selected] = next;
            if (selected) {
              setView(selected);
            }
          }}
          size="sm"
          value={[state.view]}
          variant="outline"
        >
          <ToggleGroupItem aria-label="Grid view" value="grid">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="Table view" value="table">
            <Table className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}

export { ExploreToolbar };
