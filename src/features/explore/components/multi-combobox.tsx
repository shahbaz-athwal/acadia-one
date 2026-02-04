"use client";

import { ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type MultiComboboxProps = {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
};

function MultiCombobox({
  options,
  value,
  onChange,
  placeholder = "Select options",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
  disabled = false,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedLabels = useMemo(() => {
    const selectedSet = new Set(value);
    return options
      .filter((option) => selectedSet.has(option.value))
      .map((option) => option.label);
  }, [options, value]);

  const buttonLabel = useMemo(() => {
    if (selectedLabels.length === 0) {
      return placeholder;
    }
    if (selectedLabels.length <= 2) {
      return selectedLabels.join(", ");
    }
    return `${selectedLabels.slice(0, 2).join(", ")} +${
      selectedLabels.length - 2
    }`;
  }, [placeholder, selectedLabels]);

  function toggleValue(nextValue: string) {
    const selectedSet = new Set(value);
    if (selectedSet.has(nextValue)) {
      onChange(value.filter((entry) => entry !== nextValue));
      return;
    }
    onChange([...value, nextValue]);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between gap-2"
          )}
          disabled={disabled}
          role="combobox"
          type="button"
        >
          <span
            className={cn(
              "truncate text-left",
              selectedLabels.length === 0 && "text-muted-foreground"
            )}
          >
            {buttonLabel}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const selected = value.includes(option.value);
                  return (
                    <CommandItem
                      data-checked={selected}
                      key={option.value}
                      onSelect={() => {
                        toggleValue(option.value);
                      }}
                      value={`${option.label} ${option.value}`}
                    >
                      <span className="flex-1">{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {value.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        clearAll();
                      }}
                      value="__clear__"
                    >
                      <X className="size-4 text-muted-foreground" />
                      Clear selection
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedLabels.map((label) => (
            <Badge className="truncate" key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export { MultiCombobox };
