import { Frame } from "@/components/ui/frame";
import { cn } from "@/lib/utils";

export function CourseView({ className }: { className?: string }) {
  return (
    <Frame className={cn("h-full min-h-0 overflow-hidden py-0", className)} />
  );
}
