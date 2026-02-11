import { Checkbox } from "@/components/ui/checkbox";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Label } from "@/components/ui/label";
import { useExploreFilters } from "@/hooks/use-explore-filters";

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
] as const;

export function DaysFilter() {
  const { filters, setDays } = useExploreFilters();

  return (
    <CheckboxGroup
      onValueChange={(next) => setDays(next.map(Number))}
      value={filters.days.map(String)}
    >
      {WEEKDAYS.map((day) => (
        <Label className="flex items-center gap-2" key={day.value}>
          <Checkbox name={`day-${day.value}`} value={String(day.value)} />
          {day.label}
        </Label>
      ))}
    </CheckboxGroup>
  );
}
