"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedTooltipTextProps {
  text: string;
  className?: string;
  containerClassName?: string;
  tooltipClassName?: string;
  tooltipAlign?: React.ComponentProps<typeof TooltipPopup>["align"];
  tooltipSide?: React.ComponentProps<typeof TooltipPopup>["side"];
  tooltipSideOffset?: React.ComponentProps<typeof TooltipPopup>["sideOffset"];
}

function TruncatedTooltipText({
  text,
  className,
  containerClassName,
  tooltipClassName,
  tooltipAlign,
  tooltipSide,
  tooltipSideOffset,
}: TruncatedTooltipTextProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = useCallback(() => {
    const element = textRef.current;
    if (!element) {
      return;
    }
    setIsTruncated(element.scrollWidth > element.clientWidth + 1);
  }, []);

  useEffect(() => {
    checkTruncation();
    const element = textRef.current;
    if (!element) {
      return;
    }

    let animationFrameId = 0;
    const scheduleCheck = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(checkTruncation);
    };

    scheduleCheck();
    window.addEventListener("resize", scheduleCheck);

    const fontSet = document.fonts;
    void fontSet.ready.then(scheduleCheck);
    fontSet.addEventListener("loadingdone", scheduleCheck);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", scheduleCheck);
        fontSet.removeEventListener("loadingdone", scheduleCheck);
      };
    }

    const observer = new ResizeObserver(scheduleCheck);
    observer.observe(element);
    if (element.parentElement) {
      observer.observe(element.parentElement);
    }

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleCheck);
      fontSet.removeEventListener("loadingdone", scheduleCheck);
    };
  }, [checkTruncation, text]);

  const trigger = (
    <span
      className={cn("min-w-0 flex-1", containerClassName)}
      onPointerEnter={checkTruncation}
    >
      <span className={cn("block truncate", className)} ref={textRef}>
        {text}
      </span>
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger disabled={!isTruncated} render={trigger} />
      <TooltipPopup
        align={tooltipAlign}
        className={cn(
          "max-w-72 whitespace-normal leading-snug",
          tooltipClassName
        )}
        side={tooltipSide}
        sideOffset={tooltipSideOffset}
      >
        {text}
      </TooltipPopup>
    </Tooltip>
  );
}

export { TruncatedTooltipText };
