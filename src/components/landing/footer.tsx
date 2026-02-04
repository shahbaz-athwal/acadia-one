import { Github, Pickaxe } from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Link className="flex items-center gap-2 font-semibold" href="/">
              <Pickaxe className="size-5" />
              <span>AcadiaOne</span>
            </Link>
            <p className="mt-4 max-w-xs text-muted-foreground text-sm">
              A community-driven platform to help Acadia students navigate
              course registration with ease.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <a
                className="text-muted-foreground transition-colors hover:text-foreground"
                href="https://github.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Github className="size-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-medium text-sm">Resources</h3>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <Link className="hover:text-foreground" href="/courses">
                  Courses
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/profs">
                  Professors
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/roadmaps">
                  Roadmaps
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-medium text-sm">Project</h3>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <a
                  className="hover:text-foreground"
                  href="https://github.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open Source
                </a>
              </li>
              <li>
                <Link className="hover:text-foreground" href="/roadmap">
                  Developer Roadmap
                </Link>
              </li>
              <li>
                <a
                  className="hover:text-foreground"
                  href="https://dalsearch.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Inspired by DalSearch
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 text-center text-muted-foreground text-xs sm:flex-row sm:text-left">
          <p>
            Not affiliated with Acadia University. Built by students, for
            students.
          </p>
          <p>&copy; {new Date().getFullYear()} AcadiaOne</p>
        </div>
      </div>
    </footer>
  );
}
