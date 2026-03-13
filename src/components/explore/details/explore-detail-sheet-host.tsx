import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { useExploreDetailSheet } from "@/hooks/use-explore-detail-sheet";
import { formatDetailTarget } from "@/lib/explore-detail-sheet";
import { courseSheetQuery, professorSheetQuery } from "@/queries/explore";

interface CourseSheetData {
  code: string;
  title: string;
  description: string;
  credits: number;
  isLab: boolean;
  ratingCount: number;
  avgDifficulty: number | null;
  avgQuality: number | null;
}

interface ProfessorSheetData {
  externalId: string;
  name: string;
  departmentPrefix: string;
  designation?: string;
  officeLocation?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  imageUrl?: string;
  ratingCount: number;
  avgDifficulty: number | null;
  avgQuality: number | null;
}

export function ExploreDetailSheetHost() {
  const { close, isOpen, rawDetail, replaceDetail, target } =
    useExploreDetailSheet();
  const courseQuery = useQuery({
    ...courseSheetQuery(target?.kind === "course" ? target.courseCode : ""),
    enabled: target?.kind === "course",
  });
  const professorQuery = useQuery({
    ...professorSheetQuery(
      target?.kind === "professor" ? target.professorExternalId : ""
    ),
    enabled: target?.kind === "professor",
  });

  useEffect(() => {
    if (!rawDetail) {
      return;
    }

    if (!target) {
      replaceDetail("");
      return;
    }

    const canonicalDetail = formatDetailTarget(target);
    if (canonicalDetail !== rawDetail) {
      replaceDetail(canonicalDetail);
    }
  }, [rawDetail, replaceDetail, target]);

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
      open={isOpen}
    >
      {target ? (
        <SheetPopup
          className="w-[min(36rem,calc(100%-3rem))] max-w-none"
          side="right"
        >
          {target.kind === "course" ? (
            <CourseDetailSheetBody
              courseCode={target.courseCode}
              data={courseQuery.data}
              isLoading={courseQuery.isPending}
            />
          ) : (
            <ProfessorDetailSheetBody
              data={professorQuery.data}
              externalId={target.professorExternalId}
              isLoading={professorQuery.isPending}
            />
          )}
        </SheetPopup>
      ) : null}
    </Sheet>
  );
}

function CourseDetailSheetBody({
  courseCode,
  data,
  isLoading,
}: {
  courseCode: string;
  data: CourseSheetData | null | undefined;
  isLoading: boolean;
}) {
  const title = data ? `${data.code} ${data.title}` : courseCode;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>
          {isLoading
            ? "Loading course details."
            : "Course details are coming soon."}
        </SheetDescription>
      </SheetHeader>
      <SheetPanel className="space-y-3">
        {isLoading || data ? (
          <SheetStateMessage
            description="Course details coming soon."
            title="Placeholder"
          />
        ) : (
          <SheetStateMessage
            description="We couldn't find a course for this URL."
            title="Course not found"
          />
        )}
      </SheetPanel>
    </>
  );
}

function ProfessorDetailSheetBody({
  externalId,
  data,
  isLoading,
}: {
  externalId: string;
  data: ProfessorSheetData | null | undefined;
  isLoading: boolean;
}) {
  const title = data?.name ?? externalId;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>
          {isLoading
            ? "Loading professor details."
            : "Professor details are coming soon."}
        </SheetDescription>
      </SheetHeader>
      <SheetPanel className="space-y-3">
        {isLoading || data ? (
          <SheetStateMessage
            description="Professor details coming soon."
            title="Placeholder"
          />
        ) : (
          <SheetStateMessage
            description="We couldn't find a professor for this URL."
            title="Professor not found"
          />
        )}
      </SheetPanel>
    </>
  );
}

function SheetStateMessage({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="font-medium text-sm">{title}</div>
      <p className="mt-1 text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
