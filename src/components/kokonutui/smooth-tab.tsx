"use client";

/**
 * @author: @dorianbaffier
 * @description: Smooth Tab
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipPopup,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface TabItem {
  id: string;
  title: string;
  icon?: React.ComponentType<any>;
  badge?: number | string;
  content?: React.ReactNode;
  cardContent?: React.ReactNode;
  color?: string;
}

interface SmoothTabProps {
  items: TabItem[];
  defaultTabId: string;
  value?: string;
  className?: string;
  activeColor?: string;
  compact?: boolean;
  onChange?: (tabId: string) => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.95,
    position: "absolute" as const,
  }),
  center: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    position: "absolute" as const,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.95,
    position: "absolute" as const,
  }),
};

const transition = {
  duration: 0.4,
  ease: [0.32, 0.72, 0, 1],
};

const contentVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 24 : -24,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 24 : -24,
    opacity: 0,
  }),
};

const contentTransition = {
  duration: 0.15,
  ease: [0.32, 0.72, 0, 1] as const,
};

function TabIcon({
  icon: Icon,
  isSelected,
  compact,
}: {
  icon: React.ComponentType<any>;
  isSelected: boolean;
  compact: boolean;
}) {
  const iconRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (iconRef.current?.startAnimation && isSelected) {
      iconRef.current.startAnimation();
    } else if (iconRef.current?.stopAnimation) {
      iconRef.current.stopAnimation();
    }
  }, [isSelected]);

  return <Icon ref={iconRef} size={compact ? 12 : 16} className="shrink-0" />;
}

export default function SmoothTab({
  items,
  defaultTabId,
  value,
  className,
  activeColor = "bg-[#1F9CFE]",
  compact = false,
  onChange,
}: SmoothTabProps) {
  const [internalSelected, setInternalSelected] =
    React.useState<string>(defaultTabId);
  const selected = value ?? internalSelected;
  const [direction, setDirection] = React.useState(0);
  const [dimensions, setDimensions] = React.useState({ width: 0, left: 0 });
  const [labelsHidden, setLabelsHidden] = React.useState(false);

  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = React.useRef<HTMLDivElement>(null);
  const spanRefs = React.useRef<Map<string, HTMLSpanElement>>(new Map());
  const canHideLabels = items.every((item) => item.icon != null);

  // Update dimensions whenever selected tab changes, on mount, or container resizes
  React.useLayoutEffect(() => {
    const container = containerRef.current;

    const updateDimensions = () => {
      const selectedButton = buttonRefs.current.get(selected);

      if (selectedButton && container) {
        const rect = selectedButton.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setDimensions({
          width: rect.width,
          left: rect.left - containerRect.left,
        });
      }
    };

    requestAnimationFrame(() => {
      updateDimensions();
    });

    if (!container) return;

    const ro = new ResizeObserver(() => {
      updateDimensions();
      setLabelsHidden(false);
    });
    ro.observe(container);

    return () => ro.disconnect();
  }, [selected]);

  React.useLayoutEffect(() => {
    if (labelsHidden || !canHideLabels) return;
    for (const span of spanRefs.current.values()) {
      if (span && span.scrollWidth > span.clientWidth + 0.5) {
        setLabelsHidden(true);
        return;
      }
    }
  });

  const handleTabClick = (tabId: string) => {
    const currentIndex = items.findIndex((item) => item.id === selected);
    const newIndex = items.findIndex((item) => item.id === tabId);
    setDirection(newIndex > currentIndex ? 1 : -1);
    if (value === undefined) {
      setInternalSelected(tabId);
    }
    onChange?.(tabId);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    tabId: string
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTabClick(tabId);
    }
  };

  const selectedItem = items.find((item) => item.id === selected);
  const hasCardContent = items.some((item) => item.cardContent);
  const hasContent = items.some((item) => item.content);

  const indicatorInset = compact ? 3 : 4;

  const tabBar = (
    <div
      aria-label="Smooth tabs"
      className={cn(
        "relative flex items-center justify-between gap-1",
        compact ? "py-0.5" : "py-1",
        "w-full bg-background",
        compact ? "rounded-lg border" : "rounded-xl border",
        "transition-all duration-200",
        className
      )}
      ref={containerRef}
      role="tablist"
    >
      <motion.div
        animate={{
          width: dimensions.width - indicatorInset * 2,
          x: dimensions.left + indicatorInset,
          opacity: 1,
        }}
        className={cn(
          "absolute z-1",
          compact ? "rounded-md" : "rounded-lg",
          selectedItem?.color || activeColor
        )}
        initial={false}
        style={{
          height: `calc(100% - ${indicatorInset * 2}px)`,
          top: `${indicatorInset}px`,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
      />

      <div
        className={cn("relative z-2 grid w-full", compact ? "gap-0.5" : "gap-1")}
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
          const isSelected = selected === item.id;
          const Icon = item.icon;
          const showTooltip = canHideLabels && labelsHidden;
          const button = (
            <motion.button
              aria-controls={`panel-${item.id}`}
              aria-selected={isSelected}
              className={cn(
                "relative flex items-center justify-center",
                compact
                  ? "gap-1 rounded-md px-1.5 py-0.5"
                  : "gap-1.5 rounded-lg px-2 py-1.5",
                compact ? "font-medium text-xs" : "font-medium text-sm",
                "transition-all duration-300",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "truncate",
                isSelected
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              id={`tab-${item.id}`}
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item.id)}
              ref={(el) => {
                if (el) buttonRefs.current.set(item.id, el);
                else buttonRefs.current.delete(item.id);
              }}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
            >
              {Icon && <TabIcon icon={Icon} isSelected={isSelected} compact={compact} />}
              {!showTooltip && (
                <span
                  className="truncate"
                  ref={(el) => {
                    if (el) spanRefs.current.set(item.id, el);
                    else spanRefs.current.delete(item.id);
                  }}
                >
                  {item.title}
                </span>
              )}
              {item.badge != null && item.badge !== 0 && (
                <span
                  className={cn(
                    "ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold leading-none",
                    isSelected
                      ? "bg-primary-foreground/25 text-primary-foreground"
                      : "bg-primary/15 text-primary"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </motion.button>
          );

          if (showTooltip) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger render={button} />
                <TooltipPopup side="bottom">{item.title}</TooltipPopup>
              </Tooltip>
            );
          }

          return button;
        })}
      </div>
    </div>
  );

  if (hasCardContent) {
    return (
      <div className="flex h-full flex-col">
        <div className="relative mb-4 flex-1">
          <div className="relative h-[200px] w-full rounded-lg border bg-card">
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <AnimatePresence
                custom={direction}
                initial={false}
                mode="popLayout"
              >
                <motion.div
                  animate="center"
                  className="absolute inset-0 h-full w-full bg-card will-change-transform"
                  custom={direction}
                  exit="exit"
                  initial="enter"
                  key={`card-${selected}`}
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                  transition={transition as any}
                  variants={slideVariants as any}
                >
                  {selectedItem?.cardContent}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {tabBar}
      </div>
    );
  }

  if (hasContent) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        {tabBar}
        <div className="relative min-h-0 flex-1">
          <ScrollArea className="h-full" scrollFade>
            <AnimatePresence
              custom={direction}
              initial={false}
              mode="wait"
            >
              <motion.div
                animate="center"
                className="h-full"
                custom={direction}
                exit="exit"
                initial="enter"
                key={`content-${selected}`}
                transition={contentTransition}
                variants={contentVariants}
              >
                {selectedItem?.content}
              </motion.div>
            </AnimatePresence>
          </ScrollArea>
        </div>
      </div>
    );
  }

  return tabBar;
}
