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
import { cn } from "@/lib/utils";

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
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const composerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    setIsOpen(false);
    setPrompt("");
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

  const isGenerateDisabled = prompt.trim().length === 0;

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

        <MorphingPopoverContent className="right-0 bottom-0 w-[min(24rem,calc(100vw-2rem))] rounded-[1.5rem] border-input bg-background p-2 text-foreground shadow-black/12 shadow-xl">
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
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <Textarea
                aria-label="AI schedule prompt"
                className="rounded-[1.125rem] border-transparent bg-transparent shadow-none before:hidden"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Make me a schdeule with no class on friday. or No class after 4 pm"
                size="sm"
                style={{ resize: "none" }}
                value={prompt}
              />
              <div className="flex justify-end">
                <Button disabled={isGenerateDisabled} size="sm" type="submit">
                  Generate
                </Button>
              </div>
            </form>
          </motion.div>
        </MorphingPopoverContent>
      </MorphingPopover>
    </div>
  );
}
