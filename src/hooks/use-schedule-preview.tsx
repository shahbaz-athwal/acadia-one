import { createContext, type ReactNode, useContext, useState } from "react";

export interface PreviewSection {
  color: string;
  course: { code: string; title: string };
  section: {
    termCode: string;
    classStartTime: string;
    classEndTime: string;
    days: number[];
    sectionCode: string;
    isOnline: boolean;
    buildingName: string;
    roomNumber: string;
    professorName: string;
  };
}

interface SchedulePreviewContextValue {
  previewSection: PreviewSection | null;
  setPreviewSection: (section: PreviewSection | null) => void;
}

const SchedulePreviewContext = createContext<SchedulePreviewContextValue>({
  previewSection: null,
  setPreviewSection: () => undefined,
});

export function SchedulePreviewProvider({ children }: { children: ReactNode }) {
  const [previewSection, setPreviewSection] = useState<PreviewSection | null>(null);

  return (
    <SchedulePreviewContext value={{ previewSection, setPreviewSection }}>
      {children}
    </SchedulePreviewContext>
  );
}

export function useSchedulePreview() {
  return useContext(SchedulePreviewContext);
}
