import { useQuery } from "@tanstack/react-query";
import {
  Building2Icon,
  ExternalLinkIcon,
  GraduationCapIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { getInitials } from "@/lib/utils";
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
  departmentName: string;
  designation?: string;
  officeLocation?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  imageUrl?: string;
  description?: string;
  researchAreas?: string[];
  sourceUrl?: string;
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
  let body: React.ReactNode;

  if (isLoading) {
    body = (
      <SheetStateMessage
        description="Professor details are loading."
        title="Loading"
      />
    );
  } else if (data) {
    body = <ProfessorProfileContent data={data} />;
  } else {
    body = (
      <SheetStateMessage
        description="We couldn't find a professor for this URL."
        title="Professor not found"
      />
    );
  }

  return (
    <>
      <SheetHeader className="pr-16">
        <div className="flex items-start justify-between gap-3">
          <SheetTitle>{title}</SheetTitle>
          {data?.sourceUrl ? (
            <a
              className={buttonVariants({
                size: "xs",
                variant: "outline",
              })}
              href={data.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Source
              <ExternalLinkIcon />
            </a>
          ) : null}
        </div>
      </SheetHeader>
      <SheetPanel className="space-y-3">{body}</SheetPanel>
    </>
  );
}

function ProfessorProfileContent({ data }: { data: ProfessorSheetData }) {
  return (
    <>
      <section className="space-y-2">
        <div className="flex items-start gap-3">
          <Avatar className="size-28 shrink-0 rounded-xl bg-muted/40 text-base">
            {data.imageUrl ? (
              <AvatarImage alt={data.name} src={data.imageUrl} />
            ) : null}
            <AvatarFallback className="rounded-xl">
              {getInitials(data.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1 pt-0.5">
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Building2Icon className="size-4 shrink-0" />
              <span className="truncate leading-tight">{`Department of ${data.departmentName}`}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <GraduationCapIcon className="size-4 shrink-0" />
              <span className="truncate leading-tight">
                {data.designation ?? "-"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <MapPinIcon className="size-4 shrink-0" />
              <span className="truncate leading-tight">
                {data.officeLocation ?? "-"}
              </span>
            </div>
            <ProfessorInfoItem
              href={data.email ? `mailto:${data.email}` : undefined}
              icon={MailIcon}
              value={data.email ?? "-"}
            />
            <ProfessorInfoItem
              href={data.phone ? `tel:${data.phone}` : undefined}
              icon={PhoneIcon}
              value={data.phone ?? "-"}
            />
          </div>
        </div>
      </section>

      {data.researchAreas && data.researchAreas.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-medium text-sm">Research Area</h3>
          <div className="flex flex-wrap gap-2">
            {data.researchAreas.map((area) => (
              <Badge key={area} variant="outline">
                {area}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function ProfessorInfoItem({
  href,
  icon: Icon,
  value,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  const content = (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 truncate text-sm">{value}</div>
    </>
  );

  if (href) {
    return (
      <a
        className="flex min-w-0 items-start gap-1.5 transition-colors hover:text-foreground/80"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return <div className="flex min-w-0 items-start gap-1.5">{content}</div>;
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
