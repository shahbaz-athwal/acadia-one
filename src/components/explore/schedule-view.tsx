import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ScheduleView({ className }: { className?: string }) {
  return <Card className={cn("h-full overflow-hidden py-0", className)} />;
}
