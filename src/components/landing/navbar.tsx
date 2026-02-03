"use client";

import { Moon, Pickaxe, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link className="flex items-center gap-2 font-semibold" href="/">
          <Pickaxe className="size-5" />
          <span>AcadiaOne</span>
        </Link>

        <div className="flex items-center gap-1">
          <button
            className="flex w-40 items-center justify-between gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted"
            type="button"
          >
            <span className="hidden sm:inline">Search...</span>
            <Kbd>⌘K</Kbd>
          </button>

          <Link
            className="rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            href="/explore"
          >
            Courses
          </Link>
          <Link
            className="rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            href="/profs"
          >
            Profs
          </Link>
          <Link
            className="rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            href="/plans"
          >
            Plans
          </Link>

          <button
            aria-label="Toggle theme"
            className={cn(
              "ml-1 rounded-lg p-2 transition-colors hover:bg-accent"
            )}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            type="button"
          >
            <Sun className="dark:-rotate-90 size-4 rotate-0 scale-100 transition-transform dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </button>
        </div>
      </nav>
    </header>
  );
}
