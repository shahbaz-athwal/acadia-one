import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import { ExploreWorkspace } from "@/features/explore/components/explore-workspace";
import { getInitialWorkspaceLayout } from "@/features/explore/layout/workspace-layout";
import { parseWorkspaceLayout } from "@/features/explore/layout/workspace-layout-cookie";

function RouteComponent() {
  const loaderData: unknown = useLoaderData({ from: "/" });
  const initialLayout = parseWorkspaceLayout(loaderData);

  return (
    <main className="h-dvh overflow-hidden overscroll-none">
      <ExploreWorkspace initialLayout={initialLayout} />
    </main>
  );
}

export const Route = createFileRoute("/")({
  component: RouteComponent,
  loader: async () => await getInitialWorkspaceLayout(),
});
