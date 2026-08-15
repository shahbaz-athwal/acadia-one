import type { ReactNode } from "react";

interface WorkspaceSectionProps {
  children?: ReactNode;
  description: string;
  title: string;
}

export const WorkspaceSection = ({
  children,
  description,
  title,
}: WorkspaceSectionProps) => (
  <section className="flex h-full min-h-0 flex-col overflow-hidden">
    <header className="border-b px-4 py-3">
      <h2 className="font-medium text-sm">{title}</h2>
      <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
    </header>
    <div className="min-h-0 flex-1">{children}</div>
  </section>
);
