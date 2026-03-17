import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  BookOpenTextIcon,
  Building2Icon,
  ExternalLinkIcon,
  GaugeIcon,
  GlobeIcon,
  GraduationCapIcon,
  LinkedinIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  UserRoundIcon,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  const subtitle = isLoading
    ? "Loading professor details."
    : data
      ? "Profile, contact details, and rating summary."
      : "Professor details could not be found.";

  return (
    <>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{subtitle}</SheetDescription>
      </SheetHeader>
      <SheetPanel className="space-y-5">
        {isLoading ? (
          <SheetStateMessage
            description="Professor details are loading."
            title="Loading"
          />
        ) : data ? (
          <ProfessorProfileContent data={data} />
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

function ProfessorProfileContent({ data }: { data: ProfessorSheetData }) {
  const detailItems = [
    {
      icon: Building2Icon,
      label: "Department",
      value: data.departmentPrefix,
    },
    {
      icon: GraduationCapIcon,
      label: "Designation",
      value: data.designation,
    },
    {
      icon: MapPinIcon,
      label: "Office",
      value: data.officeLocation,
    },
    {
      icon: MailIcon,
      label: "Email",
      value: data.email,
      href: data.email ? `mailto:${data.email}` : undefined,
    },
    {
      icon: PhoneIcon,
      label: "Phone",
      value: data.phone,
      href: data.phone ? `tel:${data.phone}` : undefined,
    },
    {
      icon: GlobeIcon,
      label: "Website",
      value: data.websiteUrl,
      href: data.websiteUrl,
    },
    {
      icon: LinkedinIcon,
      label: "LinkedIn",
      value: data.linkedinUrl,
      href: data.linkedinUrl,
    },
    {
      icon: ExternalLinkIcon,
      label: "Source",
      value: data.sourceUrl,
      href: data.sourceUrl,
    },
  ].filter((item) => !!item.value);

  return (
    <>
      <section className="rounded-2xl border bg-muted/25 p-4">
        <div className="flex items-start gap-4">
          <Avatar className="size-20 rounded-2xl border bg-background text-lg">
            {data.imageUrl ? (
              <AvatarImage alt={data.name} src={data.imageUrl} />
            ) : null}
            <AvatarFallback className="rounded-2xl">
              {getInitials(data.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  <Building2Icon />
                  {data.departmentPrefix}
                </Badge>
                {data.designation ? (
                  <Badge variant="secondary">
                    <UserRoundIcon />
                    {data.designation}
                  </Badge>
                ) : null}
              </div>
              {data.description ? (
                <p className="text-muted-foreground text-sm leading-6">
                  {data.description}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No faculty bio available yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-medium text-sm">Ratings</h3>
          <p className="text-muted-foreground text-sm">
            Average scores and total review count.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ProfessorMetricCard
            icon={StarIcon}
            label="Avg quality"
            suffix="/5"
            value={formatAverageScore(data.avgQuality)}
          />
          <ProfessorMetricCard
            icon={GaugeIcon}
            label="Avg difficulty"
            suffix="/5"
            value={formatAverageScore(data.avgDifficulty)}
          />
          <ProfessorMetricCard
            icon={BookOpenTextIcon}
            label="Total ratings"
            value={String(data.ratingCount)}
          />
        </div>
      </section>

      {detailItems.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className="font-medium text-sm">Details</h3>
            <p className="text-muted-foreground text-sm">
              Contact and profile links.
            </p>
          </div>
          <div className="space-y-2">
            {detailItems.map((item) => (
              <ProfessorDetailRow
                href={item.href}
                icon={item.icon}
                key={item.label}
                label={item.label}
                value={item.value as string}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data.researchAreas && data.researchAreas.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className="font-medium text-sm">Research areas</h3>
            <p className="text-muted-foreground text-sm">
              Topics associated with this professor.
            </p>
          </div>
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

function ProfessorMetricCard({
  icon: Icon,
  label,
  suffix,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  suffix?: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.18em]">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-3 flex items-end gap-1">
        <span className="font-heading text-3xl leading-none">{value}</span>
        {suffix ? (
          <span className="pb-0.5 text-muted-foreground text-sm">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

function ProfessorDetailRow({
  href,
  icon: Icon,
  label,
  value,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  const content = (
    <>
      <div className="flex size-9 items-center justify-center rounded-xl bg-muted/50">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
          {label}
        </div>
        <div className="truncate text-sm">{value}</div>
      </div>
      {href ? <ExternalLinkIcon className="size-4 text-muted-foreground" /> : null}
    </>
  );

  if (href) {
    return (
      <a
        className="flex items-center gap-3 rounded-2xl border bg-background p-3 transition-colors hover:bg-muted/30"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-background p-3">
      {content}
    </div>
  );
}

function formatAverageScore(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "--";
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
