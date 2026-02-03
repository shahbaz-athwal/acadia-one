"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { Kbd } from "@/components/ui/kbd";

export function Hero() {
  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 pt-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-bold text-4xl tracking-tight sm:text-5xl">
          Course Registration Made Easy
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Ratings, Notes, Forums, Schedule all in one place
        </p>

        <button
          className="mx-auto mt-8 flex w-full max-w-md items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-left text-muted-foreground transition-colors hover:bg-muted/50"
          type="button"
        >
          <Search className="size-5" />
          <span className="flex-1">
            Search courses, professors, or topics...
          </span>
          <Kbd>⌘K</Kbd>
        </button>

        <Link
          className="mt-6 inline-block text-muted-foreground text-sm underline-offset-4 hover:underline"
          href="/roadmaps"
        >
          View Roadmaps
        </Link>
      </div>
    </section>
  );
}
