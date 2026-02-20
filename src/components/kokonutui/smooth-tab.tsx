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

export interface TabItem {
  id: string;
  title: string;
  icon?: React.ComponentType<any>;
  badge?: number | string;
  content?: React.ReactNode;
  cardContent?: React.ReactNode;
  color?: string;
}

const WaveformPath = () => (
  <motion.path
    animate={{
      x: [0, 10, 0],
      transition: {
        duration: 5,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      },
    }}
    d="M0 50 
           C 20 40, 40 30, 60 50
           C 80 70, 100 60, 120 50
           C 140 40, 160 30, 180 50
           C 200 70, 220 60, 240 50
           C 260 40, 280 30, 300 50
           C 320 70, 340 60, 360 50
           C 380 40, 400 30, 420 50
           L 420 100 L 0 100 Z"
    initial={false}
  />
);

const DEFAULT_TABS: TabItem[] = [
  {
    id: "Models",
    title: "Models",
    color: "bg-blue-500 hover:bg-blue-600",
    cardContent: (
      <div className="relative h-full">
        <div className="absolute inset-0 overflow-hidden">
          <svg
            aria-hidden="true"
            className="absolute bottom-0 h-32 w-full"
            preserveAspectRatio="none"
            role="presentation"
            viewBox="0 0 420 100"
          >
            <motion.g
              animate={{ opacity: 0.15 }}
              className="fill-blue-500 stroke-blue-500"
              initial={{ opacity: 0 }}
              style={{ strokeWidth: 1 }}
              transition={{ duration: 0.5 }}
            >
              <WaveformPath />
            </motion.g>
            <motion.g
              animate={{ opacity: 0.1 }}
              className="fill-blue-500 stroke-blue-500"
              initial={{ opacity: 0 }}
              style={{
                strokeWidth: 1,
                transform: "translateY(10px)",
              }}
              transition={{ duration: 0.5 }}
            >
              <WaveformPath />
            </motion.g>
          </svg>
        </div>
        <div className="relative flex h-full flex-col p-6">
          <div className="space-y-2">
            <h3 className="bg-linear-to-r from-foreground via-foreground/90 to-foreground/70 font-semibold text-2xl tracking-tight [text-shadow:_0_1px_1px_rgb(0_0_0_/_10%)]">
              Models
            </h3>
            <p className="max-w-[90%] text-black/50 text-sm leading-relaxed dark:text-white/50">
              Choose the model you want to use
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "MCPs",
    title: "MCPs",
    color: "bg-purple-500 hover:bg-purple-600",
    cardContent: (
      <div className="relative h-full">
        <div className="absolute inset-0 overflow-hidden">
          <svg
            aria-hidden="true"
            className="absolute bottom-0 h-32 w-full"
            preserveAspectRatio="none"
            role="presentation"
            viewBox="0 0 420 100"
          >
            <motion.g
              animate={{ opacity: 0.15 }}
              className="fill-purple-500 stroke-purple-500"
              initial={{ opacity: 0 }}
              style={{ strokeWidth: 1 }}
              transition={{ duration: 0.5 }}
            >
              <WaveformPath />
            </motion.g>
            <motion.g
              animate={{ opacity: 0.1 }}
              className="fill-purple-500 stroke-purple-500"
              initial={{ opacity: 0 }}
              style={{
                strokeWidth: 1,
                transform: "translateY(10px)",
              }}
              transition={{ duration: 0.5 }}
            >
              <WaveformPath />
            </motion.g>
          </svg>
        </div>
        <div className="relative flex h-full flex-col p-6">
          <div className="space-y-2">
            <h3 className="bg-linear-to-r from-foreground via-foreground/90 to-foreground/70 font-semibold text-xl tracking-tight [text-shadow:_0_1px_1px_rgb(0_0_0_/_10%)]">
              MCPs
            </h3>
            <p className="max-w-[90%] text-black/50 text-sm leading-relaxed dark:text-white/50">
              Choose the MCP you want to use
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "Agents",
    title: "Agents",
    color: "bg-emerald-500 hover:bg-emerald-600",
    cardContent: (
      <div className="relative h-full">
        <div className="absolute inset-0 overflow-hidden">
          <svg
            aria-hidden="true"
            className="absolute bottom-0 h-32 w-full"
            preserveAspectRatio="none"
            role="presentation"
            viewBox="0 0 420 100"
          >
            <motion.g
              animate={{ opacity: 0.15 }}
              className="fill-emerald-500 stroke-emerald-500"
              initial={{ opacity: 0 }}
              style={{ strokeWidth: 1 }}
              transition={{ duration: 0.5 }}
            >
              <WaveformPath />
            </motion.g>
            <motion.g
              animate={{ opacity: 0.1 }}
              className="fill-emerald-500 stroke-emerald-500"
              initial={{ opacity: 0 }}
              style={{
                strokeWidth: 1,
                transform: "translateY(10px)",
              }}
              transition={{ duration: 0.5 }}
            >
              <WaveformPath />
            </motion.g>
          </svg>
        </div>
        <div className="relative flex h-full flex-col p-6">
          <div className="space-y-2">
            <h3 className="bg-linear-to-r from-foreground via-foreground/90 to-foreground/70 font-semibold text-2xl tracking-tight [text-shadow:_0_1px_1px_rgb(0_0_0_/_10%)]">
              Agents
            </h3>
            <p className="max-w-[90%] text-black/50 text-sm leading-relaxed dark:text-white/50">
              Choose the agent you want to use
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "Users",
    title: "Users",
    color: "bg-amber-500 hover:bg-amber-600",
    cardContent: (
      <div className="relative h-full">
        <div className="absolute inset-0 overflow-hidden">
          <svg
            aria-hidden="true"
            className="absolute bottom-0 h-32 w-full"
            preserveAspectRatio="none"
            role="presentation"
            viewBox="0 0 420 100"
          >
            <motion.g
              animate={{ opacity: 0.15 }}
              className="fill-amber-500 stroke-amber-500"
              initial={{ opacity: 0 }}
              style={{ strokeWidth: 1 }}
              transition={{ duration: 0.5 }}
            >
              <WaveformPath />
            </motion.g>
            <motion.g
              animate={{ opacity: 0.1 }}
              className="fill-amber-500 stroke-amber-500"
              initial={{ opacity: 0 }}
              style={{
                strokeWidth: 1,
                transform: "translateY(10px)",
              }}
              transition={{ duration: 0.5 }}
            >
              <WaveformPath />
            </motion.g>
          </svg>
        </div>
        <div className="relative flex h-full flex-col p-6">
          <div className="space-y-2">
            <h3 className="bg-linear-to-r from-foreground via-foreground/90 to-foreground/70 font-semibold text-2xl tracking-tight [text-shadow:_0_1px_1px_rgb(0_0_0_/_10%)]">
              Users
            </h3>
            <p className="max-w-[90%] text-black/50 text-sm leading-relaxed dark:text-white/50">
              Choose the user you want to use
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

interface SmoothTabProps {
  items?: TabItem[];
  defaultTabId?: string;
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
  items = DEFAULT_TABS,
  defaultTabId = DEFAULT_TABS[0].id,
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
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence
            custom={direction}
            initial={false}
            mode="wait"
          >
            <motion.div
              animate="center"
              className="h-full overflow-y-auto"
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
        </div>
      </div>
    );
  }

  return tabBar;
}
