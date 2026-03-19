import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import type { ScheduleItem } from "@/hooks/use-schedule-items";
import { getBlockPosition } from "@/lib/schedule-time";
import { cn, formatDays, stripProfessorSalutations } from "@/lib/utils";
import { SparklesIcon } from "lucide-react";

interface ScheduleBlockProps {
  item: ScheduleItem;
  dimmed?: boolean;
  className?: string;
  slotHeight?: number;
  onOpenCourse?: (courseCode: string) => void;
  onOpenProfessor?: (professorExternalId: string) => void;
  onPrefetchCourse?: (courseCode: string) => void;
  onPrefetchProfessor?: (professorExternalId: string) => void;
  onRemove?: (
    scheduleItemId: ScheduleItem["scheduleItemId"]
  ) => void | Promise<void>;
}

function getLocation(item: ScheduleItem) {
  if (item.section.isOnline) {
    return "Online";
  }
  const location = [item.section.buildingName, item.section.roomNumber]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
  return location || "TBA";
}

export function ScheduleBlock({
  item,
  dimmed,
  className,
  slotHeight,
  onOpenCourse,
  onOpenProfessor,
  onPrefetchCourse,
  onPrefetchProfessor,
  onRemove,
}: ScheduleBlockProps) {
  const { top, height } = getBlockPosition(
    item.section.classStartTime,
    item.section.classEndTime,
    slotHeight
  );
  const timeLabel = `${item.section.classStartTime} - ${item.section.classEndTime}`;
  const professorName =
    stripProfessorSalutations(item.section.professorName) || "TBA";
  const professorExternalId = item.section.professorExternalId;

  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={250}
        render={
          <div
            className={cn(
              "absolute inset-x-0.5 cursor-pointer overflow-hidden rounded-md border px-2 py-1.5 text-xs leading-tight transition-opacity",
              dimmed && "opacity-20",
              className
            )}
            data-section-id={item.section.id}
            style={{
              top,
              height,
              backgroundColor: `${item.color}20`,
              borderColor: `${item.color}60`,
              color: item.color,
            }}
          >
            <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden">
              <div className="flex items-start justify-between gap-1">
                <span
                  className="min-w-0 flex-1 truncate font-semibold leading-tight"
                  style={{ color: item.color }}
                >
                  {item.course.code}
                </span>
                {item.isAiSuggested ? (
                  <Tooltip>
                    <TooltipTrigger
                      aria-label="AI suggested section"
                      className="mt-0.5 shrink-0 text-foreground/80"
                    >
                      <SparklesIcon className="size-3" />
                    </TooltipTrigger>
                    <TooltipPopup>AI suggested</TooltipPopup>
                  </Tooltip>
                ) : null}
              </div>
              <span className="truncate text-[11px] leading-tight opacity-80">
                {item.section.sectionCode}
              </span>
            </div>
          </div>
        }
      />
      <PreviewCardPopup className="w-80 flex-col gap-3 text-wrap p-3 text-left">
        <div className="flex items-center justify-between gap-3">
          <button
            className="min-w-0 text-left"
            onClick={() => onOpenCourse?.(item.course.code)}
            onFocus={() => onPrefetchCourse?.(item.course.code)}
            onMouseEnter={() => onPrefetchCourse?.(item.course.code)}
            type="button"
          >
            <div className="truncate font-semibold text-sm leading-tight hover:underline">
              {item.course.code}
            </div>
            <div className="truncate text-muted-foreground text-xs leading-tight">
              {item.course.title}
            </div>
          </button>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-medium text-[11px] text-secondary-foreground">
            {item.section.sectionCode}
          </span>
        </div>
        <dl className="grid grid-cols-[68px_1fr] gap-x-3 gap-y-2 text-xs">
          <dt className="font-medium">Timing</dt>
          <dd className="text-muted-foreground leading-snug">
            {timeLabel} ({formatDays(item.section.days)})
          </dd>
          <dt className="font-medium">Location</dt>
          <dd className="text-muted-foreground leading-snug">
            {getLocation(item)}
          </dd>
          <dt className="font-medium">Professor</dt>
          <dd className="text-muted-foreground leading-snug">
            {professorExternalId ? (
              <button
                className="transition-colors hover:text-foreground hover:underline"
                onClick={() => onOpenProfessor?.(professorExternalId)}
                onFocus={() => onPrefetchProfessor?.(professorExternalId)}
                onMouseEnter={() => onPrefetchProfessor?.(professorExternalId)}
                type="button"
              >
                {professorName}
              </button>
            ) : (
              professorName
            )}
          </dd>
        </dl>
        <Button
          className="mt-1 w-full justify-center"
          onClick={() => onRemove?.(item.scheduleItemId)}
          size="xs"
          variant="destructive"
        >
          Remove Section
        </Button>
      </PreviewCardPopup>
    </PreviewCard>
  );
}
