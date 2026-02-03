"use client";

import { useQuery } from "convex/react";
import { Fragment } from "react/jsx-runtime";
import {
  Toggle,
  ToggleGroup,
  ToggleGroupSeparator,
} from "@/components/ui/toggle-group";
import { useExploreQueryState } from "@/features/explore/query-state";
import { api } from "../../../../convex/_generated/api";

function TermMultiSelect() {
  const { state, setFilters } = useExploreQueryState();
  const value = state.filters.term;
  const terms = useQuery(api.terms.list, {});
  const termOptions =
    terms?.map((term) => ({
      value: term.code,
      label: term.name,
    })) ?? [];

  return (
    <ToggleGroup
      className="flex w-full flex-wrap"
      multiple
      onValueChange={(next: string[]) => {
        setFilters((prev) => ({ ...prev, term: next }));
      }}
      size="sm"
      value={value}
      variant="outline"
    >
      {termOptions.map((option, index) => (
        <Fragment key={option.value}>
          <Toggle value={option.value}>{option.label}</Toggle>
          {index !== termOptions.length - 1 && <ToggleGroupSeparator />}
        </Fragment>
      ))}
    </ToggleGroup>
  );
}

export { TermMultiSelect };
