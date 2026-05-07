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
  avgDifficulty: number | null;
  avgQuality: number | null;
  code: string;
  credits: number;
  description: string;
  isLab: boolean;
  ratingCount: number;
  title: string;
}

interface ProfessorSheetData {
  avgDifficulty: number | null;
  avgQuality: number | null;
  departmentName: string;
  departmentPrefix: string;
  description?: string;
  designation?: string;
  email?: string;
  externalId: string;
  imageUrl?: string;
  linkedinUrl?: string;
  name: string;
  officeLocation?: string;
  phone?: string;
  ratingCount: number;
  ratings: Array<{
    comment?: string;
    quality: number;
    difficulty: number;
    postedAt: number;
  }>;
  researchAreas?: string[];
  sourceUrl?: string;
  websiteUrl?: string;
}

const postedAtFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatAverageScore(value: number | null) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}

function formatPostedAt(value: number) {
  return postedAtFormatter.format(new Date(value));
}

export function ExploreDetailSheetHost() {
  const { close, isOpen, rawDetail, replaceDetail, target } = useExploreDetailSheet();
  const courseQuery = useQuery({
    ...courseSheetQuery(target?.kind === "course" ? target.courseCode : ""),
    enabled: target?.kind === "course",
  });
  const professorQuery = useQuery({
    ...professorSheetQuery(target?.kind === "professor" ? target.professorExternalId : ""),
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
        <SheetPopup className="w-[min(36rem,calc(100%-3rem))] max-w-none" side="right">
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
          {isLoading ? "Loading course details." : "Course details are coming soon."}
        </SheetDescription>
      </SheetHeader>
      <SheetPanel className="space-y-3">
        {isLoading || data ? (
          <SheetStateMessage description="Course details coming soon." title="Placeholder" />
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
    body = <SheetStateMessage description="Professor details are loading." title="Loading" />;
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
  const visibleRatings = data.ratings.filter((rating) => !!rating.comment?.trim());

  return (
    <>
      <section className="space-y-2">
        <div className="flex items-start gap-3">
          <Avatar className="size-28 shrink-0 rounded-xl bg-muted/40 text-base">
            {data.imageUrl ? <AvatarImage alt={data.name} src={data.imageUrl} /> : null}
            <AvatarFallback className="rounded-xl">{getInitials(data.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1 pt-0.5">
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <Building2Icon className="size-4 shrink-0" />
              <span className="truncate leading-tight">{`Department of ${data.departmentName}`}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <GraduationCapIcon className="size-4 shrink-0" />
              <span className="truncate leading-tight">{data.designation ?? "-"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <MapPinIcon className="size-4 shrink-0" />
              <span className="truncate leading-tight">{data.officeLocation ?? "-"}</span>
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
        <section className="space-y-3 pt-2">
          <h3 className="font-semibold text-xl leading-none">Research Area</h3>
          <div className="flex flex-wrap gap-2">
            {data.researchAreas.map((area) => (
              <Badge className="font-normal" key={area} variant="outline">
                {area}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {data.ratingCount > 0 ? (
        <section className="space-y-3 pt-2">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-1">
            <h3 className="font-semibold text-xl leading-none">Ratings</h3>
            <div className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-1 text-sm">
              <AggregateMetric label="Quality" value={formatAverageScore(data.avgQuality)} />
              <AggregateMetric label="Difficulty" value={formatAverageScore(data.avgDifficulty)} />
              <AggregateMetric label="Reviews" value={String(data.ratingCount)} />
            </div>
          </div>

          {visibleRatings.length > 0 ? (
            <div className="space-y-2">
              {visibleRatings.map((rating) => (
                <ProfessorRatingCard
                  key={`${rating.postedAt}-${rating.quality}-${rating.difficulty}-${rating.comment?.slice(0, 24) ?? ""}`}
                  rating={rating}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No written comments yet.</p>
          )}
        </section>
      ) : null}
    </>
  );
}

function AggregateMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 text-right">
      <span className="text-[11px] text-muted-foreground uppercase tracking-[0.08em]">{label}</span>
      <span className="font-semibold text-base leading-none">{value}</span>
    </div>
  );
}

function ProfessorRatingCard({ rating }: { rating: ProfessorSheetData["ratings"][number] }) {
  return (
    <article className="space-y-1.5 rounded-xl border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-muted-foreground text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{`Quality ${rating.quality.toFixed(1)}`}</span>
          <span>{`Difficulty ${rating.difficulty.toFixed(1)}`}</span>
        </div>
        <span>{formatPostedAt(rating.postedAt)}</span>
      </div>
      <p className="text-sm leading-5">{rating.comment?.trim()}</p>
    </article>
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

function SheetStateMessage({ description, title }: { description: string; title: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="font-medium text-sm">{title}</div>
      <p className="mt-1 text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
