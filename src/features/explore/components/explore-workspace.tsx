import type { Layout } from "react-resizable-panels";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ExploreSidebar } from "@/features/explore/components/explore-sidebar";
import { WorkspaceSection } from "@/features/explore/components/workspace-section";
import {
  RESIZE_HANDLE_CLASS_NAME,
  WORKSPACE_LAYOUT_ID,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_PANEL_SIZES,
} from "@/features/explore/layout/layout-config";
import { writeWorkspaceLayoutCookie } from "@/features/explore/layout/workspace-layout-cookie";

interface ExploreWorkspaceProps {
  initialLayout: Layout;
}

export const ExploreWorkspace = ({ initialLayout }: ExploreWorkspaceProps) => (
  <ResizablePanelGroup
    className="m-0 h-full min-h-0 p-0"
    defaultLayout={initialLayout}
    id={WORKSPACE_LAYOUT_ID}
    onLayoutChanged={writeWorkspaceLayoutCookie}
    orientation="horizontal"
  >
    <ResizablePanel
      {...WORKSPACE_PANEL_SIZES.sidebar}
      id={WORKSPACE_PANEL_IDS.sidebar}
    >
      <ExploreSidebar />
    </ResizablePanel>

    <ResizableHandle className={RESIZE_HANDLE_CLASS_NAME} />

    <ResizablePanel
      {...WORKSPACE_PANEL_SIZES.courses}
      id={WORKSPACE_PANEL_IDS.courses}
    >
      <WorkspaceSection
        description="Browse and compare available courses."
        title="Courses"
      />
    </ResizablePanel>

    <ResizableHandle className={RESIZE_HANDLE_CLASS_NAME} />

    <ResizablePanel
      {...WORKSPACE_PANEL_SIZES.schedule}
      id={WORKSPACE_PANEL_IDS.schedule}
    >
      <WorkspaceSection
        description="Preview the schedule as you build it."
        title="Schedule"
      />
    </ResizablePanel>
  </ResizablePanelGroup>
);
