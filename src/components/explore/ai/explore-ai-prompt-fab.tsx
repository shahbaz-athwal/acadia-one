import { useQueryClient } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { SparklesIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  MorphingPopover,
  MorphingPopoverContent,
  MorphingPopoverTrigger,
} from "@/components/ui/morphing-popover";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useScheduleView } from "@/hooks/use-schedule-view";
import { cn } from "@/lib/utils";
import { scheduleQuery } from "@/queries/explore";
import { api } from "../../../../convex/_generated/api";

const POPOVER_TRANSITION = {
  bounce: 0.08,
  duration: 0.35,
  type: "spring",
} as const;

const CONTENT_TRANSITION = {
  delay: 0.04,
  duration: 0.18,
  ease: "easeOut",
} as const;

export function ExploreAiPromptFab() {
  const queryClient = useQueryClient();
  const { isAuthenticated, sessionId, tokenHash } = useAuth();
  const { termCode, termName } = useScheduleView();
  const planScheduleForTerm = useAction(
    api.aiScheduleExecutor.planScheduleForTerm
  );
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    studentMessage: string;
    saved: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    setIsOpen(false);
    setPrompt("");
    setResultMessage(null);
    setError(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const textarea = composerRef.current?.querySelector("textarea");
      textarea?.focus();
      textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  if (!isAuthenticated) {
    return null;
  }

  const isGenerateDisabled = isGenerating || termCode.length === 0;

  return (
    <div
      className="pointer-events-none fixed right-0 bottom-0 z-40 p-4"
      style={{
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <MorphingPopover
        className="pointer-events-auto items-end justify-end"
        onOpenChange={setIsOpen}
        open={isOpen}
        transition={POPOVER_TRANSITION}
      >
        <MorphingPopoverTrigger
          aria-label="Open AI schedule prompt"
          className={cn(
            buttonVariants({ size: "icon-lg" }),
            "size-14 rounded-full shadow-lg shadow-primary/20 transition-opacity",
            isOpen && "pointer-events-none opacity-0"
          )}
          tabIndex={isOpen ? -1 : 0}
        >
          <SparklesIcon className="size-5" />
        </MorphingPopoverTrigger>

        <MorphingPopoverContent className="right-0 bottom-0 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border-input bg-background p-2 text-foreground shadow-black/12 shadow-xl">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 10 }}
            ref={composerRef}
            transition={CONTENT_TRANSITION}
          >
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (isGenerateDisabled) {
                  return;
                }

                setIsGenerating(true);
                setError(null);
                setResultMessage(null);

                try {
                  const result = await planScheduleForTerm({
                    sessionId,
                    tokenHash,
                    termCode,
                    instructions: prompt.trim() || undefined,
                  });

                  setResultMessage({
                    studentMessage: result.studentMessage,
                    saved: result.saved,
                  });

                  if (result.saved) {
                    await queryClient.invalidateQueries({
                      queryKey: scheduleQuery(sessionId).queryKey,
                    });
                  }
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Schedule planning failed."
                  );
                } finally {
                  setIsGenerating(false);
                }
              }}
            >
              <p className="px-2 pt-1 text-muted-foreground text-xs">
                Planning for {termName || termCode || "the selected term"}
              </p>
              <Textarea
                aria-label="AI schedule prompt"
                className="rounded-xl border-transparent bg-transparent shadow-none before:hidden"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="No class on Friday. No classes after 4 PM."
                size="sm"
                style={{ resize: "none" }}
                value={prompt}
              />
              {resultMessage ? (
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm",
                    resultMessage.saved
                      ? "bg-primary/8 text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <p>{resultMessage.studentMessage}</p>
                </div>
              ) : null}
              {error ? (
                <div className="rounded-2xl bg-destructive/10 px-3 py-2 text-destructive text-sm">
                  {error}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button disabled={isGenerateDisabled} size="sm" type="submit">
                  {isGenerating ? "Planning..." : "Generate"}
                </Button>
              </div>
            </form>
          </motion.div>
        </MorphingPopoverContent>
      </MorphingPopover>
    </div>
  );
}
