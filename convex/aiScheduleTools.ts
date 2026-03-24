import { ConvexError, v } from "convex/values";
import {
  type ConflictCheckSection,
  checkForConflicts,
  formatWeekdayNames,
  getWeekdayLongName,
  parseTimeToMinutesOrNull,
  type SectionConflict,
  WEEKDAYS,
} from "../shared/schedule-time";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { SCHEDULE_COLORS } from "./lib/constants";

type CourseDoc = Doc<"courses">;
type ProfessorDoc = Doc<"professors">;
type SectionDoc = Doc<"sections">;

interface AiTimeRange {
  end: number;
  start: number;
}

interface NormalizedAiSearchFilters {
  academicLevels: number[];
  days: number[];
  timeRange: AiTimeRange | null;
}

interface EnrichedSectionRecord {
  course: CourseDoc;
  professor: ProfessorDoc | null;
  section: SectionDoc;
}

export interface AiFormattedSection {
  buildingName: string;
  classEndTime: string;
  classStartTime: string;
  days: number[];
  daysOfWeek: string[];
  isOnline: boolean;
  professorExternalId: string | null;
  professorName: string;
  roomNumber: string;
  sectionCode: string;
  sectionId: string;
  termCode: string;
}

export interface AiCourseSearchResult {
  academicLevel: number;
  courseCode: string;
  credits: number;
  sections: AiFormattedSection[];
  title: string;
}

type ConflictSectionSource =
  | "candidate"
  | "savedSchedule"
  | "candidateAndSavedSchedule";

interface AiConflictSection extends ConflictCheckSection {
  courseCode: string;
  courseTitle: string;
  daysOfWeek: string[];
  professorName: string;
  sectionId: string;
  source: ConflictSectionSource;
}

interface AiConflictOverlap {
  day: number;
  dayOfWeek: string;
  overlapEndMinutes: number;
  overlapEndTime: string;
  overlapStartMinutes: number;
  overlapStartTime: string;
}

interface AiConflictResult {
  overlaps: AiConflictOverlap[];
  sectionA: AiConflictSection;
  sectionB: AiConflictSection;
  sharedDays: number[];
  sharedDaysOfWeek: string[];
}

interface SearchCoursesForAiResult {
  missingCourseCodes: string[];
  results: AiCourseSearchResult[];
  summary: string;
}

interface DetectScheduleConflictsForAiResult {
  candidateConflicts: AiConflictResult[];
  feedback: string[];
  hasConflicts: boolean;
  invalidSectionIds: string[];
  savedScheduleConflicts: AiConflictResult[];
  summary: string;
}

interface SaveAiScheduleSectionsResult {
  added: Array<{
    scheduleItemId: Id<"scheduleItems">;
    sectionId: string;
    color: string;
  }>;
  invalidSectionIds: string[];
  skippedExistingSectionIds: string[];
  summary: string;
  totalSavedCount: number;
}

interface ConflictSectionState {
  isCandidate: boolean;
  isSavedSchedule: boolean;
  record: EnrichedSectionRecord;
}

const DAY_VALUE_BY_NAME = new Map(
  WEEKDAYS.map((weekday) => [weekday.long.toLowerCase(), weekday.day] as const)
);

function joinHumanList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  // biome-ignore lint/style/useAtIndex: Convex typecheck targets a lib without Array.prototype.at.
  const lastValue = values.slice(-1)[0] ?? "";
  return `${values.slice(0, -1).join(", ")}, and ${lastValue}`;
}

function ensureNonEmptyUniqueStrings(
  values: string[],
  label: string
): string[] {
  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const unique = [...new Set(normalized)];
  if (unique.length === 0) {
    throw new ConvexError(`${label} must contain at least one value`);
  }

  return unique;
}

function normalizeCourseCodes(courseCodes: string[]): string[] {
  return ensureNonEmptyUniqueStrings(courseCodes, "courseCodes").map((code) =>
    code.toUpperCase()
  );
}

function normalizeSectionExternalIds(
  sectionIds: string[],
  label: string
): string[] {
  return ensureNonEmptyUniqueStrings(sectionIds, label);
}

function normalizeAiSearchFilters(filters?: {
  timeRange?: { start: string; end: string };
  daysOfWeek?: string[];
  academicLevels?: number[];
}): NormalizedAiSearchFilters {
  const academicLevels = [...new Set(filters?.academicLevels ?? [])].sort(
    (a, b) => a - b
  );

  const daysOfWeek = filters?.daysOfWeek ?? [];
  const normalizedDays = [
    ...new Set(daysOfWeek.map((day) => day.trim().toLowerCase())),
  ]
    .filter((day) => day.length > 0)
    .map((day) => {
      const dayValue = DAY_VALUE_BY_NAME.get(day);
      if (!dayValue) {
        throw new ConvexError(
          `Unknown day '${day}'. Expected full weekday names Monday through Friday.`
        );
      }
      return dayValue;
    })
    .sort((a, b) => a - b);

  const rawTimeRange = filters?.timeRange;
  let timeRange: AiTimeRange | null = null;
  if (rawTimeRange) {
    const start = parseTimeToMinutesOrNull(rawTimeRange.start);
    const end = parseTimeToMinutesOrNull(rawTimeRange.end);

    if (start === null || end === null) {
      throw new ConvexError(
        "Invalid timeRange. Use AM/PM values like '8 AM' or '3:30 PM'."
      );
    }

    timeRange = start <= end ? { start, end } : { start: end, end: start };
  }

  return {
    timeRange,
    days: normalizedDays,
    academicLevels,
  };
}

function formatProfessorName(
  section: SectionDoc,
  professor: ProfessorDoc | null
): string {
  if (professor?.name) {
    return professor.name;
  }
  return section.instructorTBD ? "TBD" : "Unknown Instructor";
}

function formatSectionForAi(record: EnrichedSectionRecord): AiFormattedSection {
  const days = [...new Set(record.section.days)].sort((a, b) => a - b);

  return {
    sectionId: record.section.externalId,
    termCode: record.section.termCode,
    sectionCode: record.section.sectionCode,
    professorName: formatProfessorName(record.section, record.professor),
    professorExternalId: record.professor?.externalId ?? null,
    classStartTime: record.section.classStartTime,
    classEndTime: record.section.classEndTime,
    days,
    daysOfWeek: formatWeekdayNames(days),
    buildingName: record.section.buildingName,
    roomNumber: record.section.roomNumber,
    isOnline: record.section.isOnline,
  };
}

function formatConflictSection(
  record: EnrichedSectionRecord,
  source: ConflictSectionSource
): AiConflictSection {
  const formattedSection = formatSectionForAi(record);

  return {
    id: record.section.externalId,
    sectionId: formattedSection.sectionId,
    termCode: formattedSection.termCode,
    sectionCode: formattedSection.sectionCode,
    classStartTime: formattedSection.classStartTime,
    classEndTime: formattedSection.classEndTime,
    days: formattedSection.days,
    daysOfWeek: formattedSection.daysOfWeek,
    courseCode: record.course.code,
    courseTitle: record.course.title,
    professorName: formattedSection.professorName,
    source,
  };
}

function sectionMatchesAiFilters(
  section: SectionDoc,
  filters: NormalizedAiSearchFilters
): boolean {
  if (
    filters.days.length > 0 &&
    !section.days.some((day) => filters.days.includes(day))
  ) {
    return false;
  }

  if (filters.timeRange) {
    if (
      typeof section.classStartMin !== "number" ||
      typeof section.classEndMin !== "number"
    ) {
      return false;
    }

    const overlaps =
      section.classStartMin < filters.timeRange.end &&
      section.classEndMin > filters.timeRange.start;

    if (!overlaps) {
      return false;
    }
  }

  return true;
}

async function enrichSections(
  ctx: QueryCtx,
  sections: SectionDoc[]
): Promise<EnrichedSectionRecord[]> {
  if (sections.length === 0) {
    return [];
  }

  const courseIds = [...new Set(sections.map((section) => section.courseId))];
  const professorIds = [
    ...new Set(
      sections
        .map((section) => section.professorId)
        .filter((professorId): professorId is Id<"professors"> => !!professorId)
    ),
  ];

  const [courses, professors] = await Promise.all([
    Promise.all(courseIds.map((courseId) => ctx.db.get(courseId))),
    Promise.all(professorIds.map((professorId) => ctx.db.get(professorId))),
  ]);

  const courseById = new Map(
    courses
      .filter((course): course is CourseDoc => course !== null)
      .map((course) => [course._id, course] as const)
  );
  const professorById = new Map(
    professors
      .filter((professor): professor is ProfessorDoc => professor !== null)
      .map((professor) => [professor._id, professor] as const)
  );

  return sections.flatMap((section) => {
    const course = courseById.get(section.courseId);
    if (!course) {
      return [];
    }

    return [
      {
        section,
        course,
        professor: section.professorId
          ? (professorById.get(section.professorId) ?? null)
          : null,
      },
    ];
  });
}

async function loadScheduleSectionsBySession(
  ctx: QueryCtx,
  sessionId: string,
  termCode?: string
): Promise<EnrichedSectionRecord[]> {
  const scheduleItems = await ctx.db
    .query("scheduleItems")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect();

  const sections = (
    await Promise.all(
      scheduleItems.map((scheduleItem) => ctx.db.get(scheduleItem.sectionId))
    )
  ).filter((section): section is SectionDoc => {
    return section !== null && (!termCode || section.termCode === termCode);
  });

  return await enrichSections(ctx, sections);
}

async function loadValidCandidateSections(
  ctx: QueryCtx,
  candidateSectionIds: string[],
  termCode: string
): Promise<{
  enrichedCandidates: EnrichedSectionRecord[];
  invalidSectionIds: string[];
}> {
  const candidateSections = await Promise.all(
    candidateSectionIds.map((sectionId) =>
      ctx.db
        .query("sections")
        .withIndex("by_externalId_and_termCode", (q) =>
          q.eq("externalId", sectionId).eq("termCode", termCode)
        )
        .collect()
    )
  );

  const invalidSectionIds: string[] = [];
  const validCandidateSections: SectionDoc[] = [];
  for (const [index, sections] of candidateSections.entries()) {
    if (sections.length !== 1) {
      invalidSectionIds.push(candidateSectionIds[index]);
      continue;
    }
    const section = sections[0];
    if (section) {
      validCandidateSections.push(section);
    }
  }

  return {
    enrichedCandidates: await enrichSections(ctx, validCandidateSections),
    invalidSectionIds,
  };
}

function buildSummary(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(" ");
}

function formatConflict(
  conflict: SectionConflict<AiConflictSection>
): AiConflictResult {
  return {
    sectionA: conflict.sectionA,
    sectionB: conflict.sectionB,
    sharedDays: conflict.sharedDays,
    sharedDaysOfWeek: formatWeekdayNames(conflict.sharedDays),
    overlaps: conflict.overlaps.map((overlap) => ({
      day: overlap.day,
      dayOfWeek: getWeekdayLongName(overlap.day),
      overlapStartMinutes: overlap.overlapStartMinutes,
      overlapEndMinutes: overlap.overlapEndMinutes,
      overlapStartTime: overlap.overlapStartTime,
      overlapEndTime: overlap.overlapEndTime,
    })),
  };
}

function formatConflictFeedback(conflict: AiConflictResult): string {
  const dayNames = joinHumanList(conflict.sharedDaysOfWeek);
  const firstOverlap = conflict.overlaps[0];
  const left = `${conflict.sectionA.courseCode} ${conflict.sectionA.sectionCode}`;
  const right = `${conflict.sectionB.courseCode} ${conflict.sectionB.sectionCode}`;

  if (!firstOverlap) {
    return `${left} overlaps with ${right}.`;
  }

  return `${left} overlaps with ${right} on ${dayNames} from ${firstOverlap.overlapStartTime} to ${firstOverlap.overlapEndTime}.`;
}

function toConflictSource(
  isCandidate: boolean,
  isSavedSchedule: boolean
): ConflictSectionSource {
  if (isCandidate && isSavedSchedule) {
    return "candidateAndSavedSchedule";
  }
  return isCandidate ? "candidate" : "savedSchedule";
}

function buildConflictState(
  enrichedCandidates: EnrichedSectionRecord[],
  savedScheduleSections: EnrichedSectionRecord[]
): {
  conflictSections: AiConflictSection[];
  stateByConflictId: Map<string, ConflictSectionState>;
} {
  const sectionStateById = new Map<Id<"sections">, ConflictSectionState>();

  for (const record of enrichedCandidates) {
    sectionStateById.set(record.section._id, {
      record,
      isCandidate: true,
      isSavedSchedule: false,
    });
  }

  for (const record of savedScheduleSections) {
    const existing = sectionStateById.get(record.section._id);
    if (existing) {
      existing.isSavedSchedule = true;
      continue;
    }

    sectionStateById.set(record.section._id, {
      record,
      isCandidate: false,
      isSavedSchedule: true,
    });
  }

  return {
    conflictSections: [...sectionStateById.values()].map((entry) =>
      formatConflictSection(
        entry.record,
        toConflictSource(entry.isCandidate, entry.isSavedSchedule)
      )
    ),
    stateByConflictId: new Map(
      [...sectionStateById.values()].map((entry) => [
        String(entry.record.section._id),
        entry,
      ])
    ),
  };
}

function classifyConflict(
  conflict: SectionConflict<AiConflictSection>,
  stateByConflictId: Map<string, ConflictSectionState>
): "candidate" | "savedSchedule" | null {
  const sectionAState = stateByConflictId.get(conflict.sectionA.id);
  const sectionBState = stateByConflictId.get(conflict.sectionB.id);
  if (!(sectionAState && sectionBState)) {
    return null;
  }

  if (sectionAState.isCandidate && sectionBState.isCandidate) {
    return "candidate";
  }

  const touchesSavedSchedule =
    (sectionAState.isCandidate && sectionBState.isSavedSchedule) ||
    (sectionBState.isCandidate && sectionAState.isSavedSchedule);

  return touchesSavedSchedule ? "savedSchedule" : null;
}

function partitionConflicts(
  rawConflicts: SectionConflict<AiConflictSection>[],
  stateByConflictId: Map<string, ConflictSectionState>
): {
  candidateConflicts: AiConflictResult[];
  savedScheduleConflicts: AiConflictResult[];
} {
  const candidateConflicts: AiConflictResult[] = [];
  const savedScheduleConflicts: AiConflictResult[] = [];

  for (const conflict of rawConflicts) {
    const formattedConflict = formatConflict(conflict);
    const classification = classifyConflict(conflict, stateByConflictId);

    if (classification === "candidate") {
      candidateConflicts.push(formattedConflict);
      continue;
    }

    if (classification === "savedSchedule") {
      savedScheduleConflicts.push(formattedConflict);
    }
  }

  return {
    candidateConflicts,
    savedScheduleConflicts,
  };
}

function buildConflictSummary(args: {
  enrichedCandidates: EnrichedSectionRecord[];
  invalidSectionIds: string[];
  candidateConflicts: AiConflictResult[];
  savedScheduleConflicts: AiConflictResult[];
}): string {
  if (args.enrichedCandidates.length === 0) {
    const emptySummary = "No valid candidate sections were available to check.";
    return args.invalidSectionIds.length > 0
      ? buildSummary([
          emptySummary,
          `${args.invalidSectionIds.length} section id${args.invalidSectionIds.length === 1 ? " was" : "s were"} invalid.`,
        ])
      : emptySummary;
  }

  const totalConflictCount =
    args.candidateConflicts.length + args.savedScheduleConflicts.length;
  let summary =
    totalConflictCount > 0
      ? buildSummary([
          `Found ${totalConflictCount} conflict${totalConflictCount === 1 ? "" : "s"}.`,
          args.candidateConflicts.length > 0
            ? `${args.candidateConflicts.length} among candidate sections.`
            : "",
          args.savedScheduleConflicts.length > 0
            ? `${args.savedScheduleConflicts.length} against the saved schedule.`
            : "",
        ])
      : "No conflicts found.";

  if (args.invalidSectionIds.length > 0) {
    summary = buildSummary([
      summary,
      `${args.invalidSectionIds.length} section id${args.invalidSectionIds.length === 1 ? " was" : "s were"} invalid.`,
    ]);
  }

  return summary;
}

export const searchCoursesForAi = query({
  args: {
    termCode: v.string(),
    courseCodes: v.array(v.string()),
    filters: v.optional(
      v.object({
        timeRange: v.optional(
          v.object({
            start: v.string(),
            end: v.string(),
          })
        ),
        daysOfWeek: v.optional(v.array(v.string())),
        academicLevels: v.optional(v.array(v.number())),
      })
    ),
  },
  handler: async (ctx, args): Promise<SearchCoursesForAiResult> => {
    const courseCodes = normalizeCourseCodes(args.courseCodes);
    const filters = normalizeAiSearchFilters(args.filters);

    const matchedCourses = await Promise.all(
      courseCodes.map((courseCode) =>
        ctx.db
          .query("courses")
          .withIndex("by_code", (q) => q.eq("code", courseCode))
          .first()
      )
    );

    const missingCourseCodes: string[] = [];
    const results: AiCourseSearchResult[] = [];

    for (const [index, course] of matchedCourses.entries()) {
      const requestedCode = courseCodes[index];
      if (!course) {
        missingCourseCodes.push(requestedCode);
        continue;
      }

      if (
        filters.academicLevels.length > 0 &&
        !filters.academicLevels.includes(course.academicLevel)
      ) {
        continue;
      }

      const sections = await ctx.db
        .query("sections")
        .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
        .collect();

      const filteredSections = sections.filter(
        (section) =>
          section.termCode === args.termCode &&
          sectionMatchesAiFilters(section, filters)
      );

      const enrichedSections = await enrichSections(ctx, filteredSections);
      const formattedSections = enrichedSections
        .map(formatSectionForAi)
        .sort((a, b) => a.sectionCode.localeCompare(b.sectionCode));

      if (formattedSections.length === 0) {
        continue;
      }

      results.push({
        courseCode: course.code,
        title: course.title,
        credits: course.credits,
        academicLevel: course.academicLevel,
        sections: formattedSections,
      });
    }

    results.sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    const totalSections = results.reduce(
      (count, course) => count + course.sections.length,
      0
    );
    const summary = buildSummary([
      `Found ${totalSections} matching section${totalSections === 1 ? "" : "s"} across ${results.length} course${results.length === 1 ? "" : "s"}.`,
      missingCourseCodes.length > 0
        ? `${missingCourseCodes.length} course code${missingCourseCodes.length === 1 ? " was" : "s were"} not found.`
        : "",
    ]);

    return {
      results,
      missingCourseCodes,
      summary,
    };
  },
});

export const detectScheduleConflictsForAi = query({
  args: {
    termCode: v.string(),
    candidateSectionIds: v.array(v.string()),
    sessionId: v.optional(v.string()),
    includeSavedSchedule: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<DetectScheduleConflictsForAiResult> => {
    const candidateSectionIds = normalizeSectionExternalIds(
      args.candidateSectionIds,
      "candidateSectionIds"
    );
    const includeSavedSchedule = args.includeSavedSchedule ?? false;

    if (includeSavedSchedule && !args.sessionId) {
      throw new ConvexError(
        "sessionId is required when includeSavedSchedule is true"
      );
    }

    const { enrichedCandidates, invalidSectionIds } =
      await loadValidCandidateSections(ctx, candidateSectionIds, args.termCode);
    const savedScheduleSections =
      includeSavedSchedule && args.sessionId
        ? await loadScheduleSectionsBySession(
            ctx,
            args.sessionId,
            args.termCode
          )
        : [];
    const { conflictSections, stateByConflictId } = buildConflictState(
      enrichedCandidates,
      savedScheduleSections
    );
    const { candidateConflicts, savedScheduleConflicts } = partitionConflicts(
      checkForConflicts(conflictSections).conflicts,
      stateByConflictId
    );

    const feedback = [...candidateConflicts, ...savedScheduleConflicts].map(
      formatConflictFeedback
    );
    const hasConflicts =
      candidateConflicts.length > 0 || savedScheduleConflicts.length > 0;
    const summary = buildConflictSummary({
      enrichedCandidates,
      invalidSectionIds,
      candidateConflicts,
      savedScheduleConflicts,
    });

    return {
      hasConflicts,
      candidateConflicts,
      savedScheduleConflicts,
      invalidSectionIds,
      summary,
      feedback,
    };
  },
});

export const saveAiScheduleSections = mutation({
  args: {
    sessionId: v.string(),
    termCode: v.string(),
    sectionIds: v.array(v.string()),
    aiSuggestionSummaries: v.optional(
      v.array(
        v.object({
          sectionId: v.string(),
          summary: v.string(),
        })
      )
    ),
    mode: v.optional(v.union(v.literal("append"), v.literal("replaceTerm"))),
  },
  handler: async (ctx, args): Promise<SaveAiScheduleSectionsResult> => {
    const mode = args.mode ?? "append";
    const uniqueSectionIds =
      args.sectionIds.length === 0 && mode === "replaceTerm"
        ? []
        : normalizeSectionExternalIds(args.sectionIds, "sectionIds");
    const aiSuggestionSummaryBySectionId = new Map(
      (args.aiSuggestionSummaries ?? []).map((entry) => [
        entry.sectionId.trim(),
        entry.summary.trim(),
      ])
    );

    const [existingScheduleItems, sections] = await Promise.all([
      ctx.db
        .query("scheduleItems")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      Promise.all(
        uniqueSectionIds.map((sectionId) =>
          ctx.db
            .query("sections")
            .withIndex("by_externalId_and_termCode", (q) =>
              q.eq("externalId", sectionId).eq("termCode", args.termCode)
            )
            .collect()
        )
      ),
    ]);

    const existingScheduleSections = (
      await Promise.all(
        existingScheduleItems.map((item) => ctx.db.get(item.sectionId))
      )
    ).filter((section): section is SectionDoc => section !== null);
    const existingSectionIdSet = new Set(
      existingScheduleSections
        .filter(
          (section) =>
            mode !== "replaceTerm" || section.termCode !== args.termCode
        )
        .map((item) => item._id)
    );
    const invalidSectionIds: string[] = [];
    const skippedExistingSectionIds: string[] = [];
    const newSections: Array<{
      externalId: string;
      dbId: Id<"sections">;
    }> = [];

    for (const [index, matchedSections] of sections.entries()) {
      const sectionId = uniqueSectionIds[index];
      if (matchedSections.length !== 1) {
        invalidSectionIds.push(sectionId);
        continue;
      }

      const section = matchedSections[0];
      if (!section) {
        invalidSectionIds.push(sectionId);
        continue;
      }

      if (existingSectionIdSet.has(section._id)) {
        skippedExistingSectionIds.push(sectionId);
        continue;
      }

      newSections.push({
        externalId: sectionId,
        dbId: section._id,
      });
    }

    if (mode === "replaceTerm") {
      const existingItemsWithSections = await Promise.all(
        existingScheduleItems.map(async (item) => ({
          item,
          section: await ctx.db.get(item.sectionId),
        }))
      );

      for (const entry of existingItemsWithSections) {
        if (entry.section?.termCode === args.termCode) {
          await ctx.db.delete(entry.item._id);
          existingSectionIdSet.delete(entry.section._id);
        }
      }
    }

    const added: SaveAiScheduleSectionsResult["added"] = [];
    const remainingScheduleItems = await ctx.db
      .query("scheduleItems")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const existingCount = remainingScheduleItems.length;

    for (const [index, section] of newSections.entries()) {
      const color =
        SCHEDULE_COLORS[(existingCount + index) % SCHEDULE_COLORS.length];
      const scheduleItemId = await ctx.db.insert("scheduleItems", {
        sessionId: args.sessionId,
        sectionId: section.dbId,
        color,
        isAiSuggested: true,
        aiSuggestionSummary: aiSuggestionSummaryBySectionId.get(
          section.externalId
        ),
        addedAt: Date.now(),
      });

      added.push({
        scheduleItemId,
        sectionId: section.externalId,
        color,
      });
    }

    const summary = buildSummary([
      `${mode === "replaceTerm" ? "Replaced the selected term with" : "Saved"} ${added.length} section${added.length === 1 ? "" : "s"}.`,
      skippedExistingSectionIds.length > 0
        ? `Skipped ${skippedExistingSectionIds.length} section${skippedExistingSectionIds.length === 1 ? "" : "s"} already in the schedule.`
        : "",
      invalidSectionIds.length > 0
        ? `${invalidSectionIds.length} section id${invalidSectionIds.length === 1 ? " was" : "s were"} invalid.`
        : "",
    ]);

    return {
      added,
      skippedExistingSectionIds,
      invalidSectionIds,
      totalSavedCount: remainingScheduleItems.length + added.length,
      summary,
    };
  },
});
