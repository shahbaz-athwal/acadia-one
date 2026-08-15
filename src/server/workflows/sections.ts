import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import type { Database } from "@/db";
import {
  courseMatchingSections,
  professors,
  sectionProfessors,
  sections,
  terms,
} from "@/db/schema";
import type { CourseId, SectionId } from "@/db/schema";
import type { AcadiaSection } from "@/server/acadia/endpoints/section-details/schema";
import type { AcadiaExtractor } from "@/server/acadia/extractor";

interface SectionDetailsExtractor {
  readonly getSectionDetails: AcadiaExtractor["getSectionDetails"];
}

interface ImportSectionDetailsOptions {
  readonly database?: Database;
  readonly extractor: SectionDetailsExtractor;
  readonly importedAt?: Date;
}

interface PendingCourseImport {
  readonly courseId: CourseId;
  readonly matchingSectionIds: string[];
  readonly sectionIds: Set<SectionId>;
}

function parseDate(value: string, field: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Acadia returned an invalid ${field}: ${value}`);
  }

  return date;
}

function parseTimeToMinutes(value: string | null) {
  if (value === null) {
    return null;
  }

  const match =
    /^(?<hours>\d{1,2}):(?<minutes>\d{2})(?::\d{2})?\s*(?<period>a\.?m\.?|p\.?m\.?)?$/iu.exec(
      value.trim()
    );

  const matchGroups = match?.groups;

  if (matchGroups === undefined) {
    return null;
  }

  let hours = Number.parseInt(matchGroups.hours ?? "", 10);
  const minutes = Number.parseInt(matchGroups.minutes ?? "", 10);
  const period = matchGroups.period?.toLowerCase().replaceAll(".", "");

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return null;
  }

  if (period !== undefined && period !== "") {
    if (hours < 1 || hours > 12) {
      return null;
    }

    if (period === "am" && hours === 12) {
      hours = 0;
    } else if (period === "pm" && hours !== 12) {
      hours += 12;
    }
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

function groupPendingImports(
  rows: {
    courseId: CourseId;
    id: string;
    sectionIds: SectionId[];
  }[]
) {
  const importsByCourse = new Map<CourseId, PendingCourseImport>();

  for (const row of rows) {
    const pendingImport = importsByCourse.get(row.courseId);

    if (pendingImport) {
      pendingImport.matchingSectionIds.push(row.id);
      for (const sectionId of row.sectionIds) {
        pendingImport.sectionIds.add(sectionId);
      }
      continue;
    }

    importsByCourse.set(row.courseId, {
      courseId: row.courseId,
      matchingSectionIds: [row.id],
      sectionIds: new Set(row.sectionIds),
    });
  }

  return [...importsByCourse.values()];
}

function validateSections(
  acadiaSections: AcadiaSection[],
  pendingImport: PendingCourseImport
) {
  const sectionsById = new Map<SectionId, AcadiaSection>();

  for (const section of acadiaSections) {
    if (section.courseId !== pendingImport.courseId) {
      throw new Error(
        `Acadia returned section ${section.id} for unexpected course ${section.courseId}.`
      );
    }

    if (!pendingImport.sectionIds.has(section.id)) {
      throw new Error(
        `Acadia returned unexpected section ${section.id} for course ${section.courseId}.`
      );
    }

    sectionsById.set(section.id, section);
  }

  return [...sectionsById.values()];
}

function persistCourseImport(
  database: Database,
  pendingImport: PendingCourseImport,
  acadiaSections: AcadiaSection[],
  importedAt: Date
) {
  const termRows = new Map<
    string,
    {
      archivedAt: null;
      endDate: Date;
      name: string;
      startDate: Date;
      termCode: string;
    }
  >();
  const professorRows = new Map<string, typeof professors.$inferInsert>();
  const sectionRows: (typeof sections.$inferInsert)[] = [];
  const sectionProfessorRows = new Map<
    string,
    typeof sectionProfessors.$inferInsert
  >();

  for (const section of acadiaSections) {
    termRows.set(section.term.termCode, {
      archivedAt: null,
      endDate: parseDate(section.term.endDate, "term end date"),
      name: section.term.name,
      startDate: parseDate(section.term.startDate, "term start date"),
      termCode: section.term.termCode,
    });

    for (const instructor of section.instructors) {
      professorRows.set(instructor.id, {
        id: instructor.id,
        name: instructor.name,
      });
    }

    if (section.meetingTimes.length === 0) {
      continue;
    }

    for (const meeting of section.meetingTimes) {
      sectionRows.push({
        buildingName: meeting.buildingName || null,
        classEnd: parseTimeToMinutes(meeting.endTime),
        classStart: parseTimeToMinutes(meeting.startTime),
        courseId: section.courseId,
        days: meeting.days,
        id: section.id,
        isOnline: meeting.isOnline,
        room: meeting.room,
        roomNumber: meeting.roomNumber || null,
        sectionCode: section.sectionCode,
        sectionSearchName: section.sectionSearchName,
        showTBD: meeting.showTBD,
        termCode: section.term.termCode,
      });
    }

    for (const instructor of section.instructors) {
      sectionProfessorRows.set(`${section.id}:${instructor.id}`, {
        professorId: instructor.id,
        sectionId: section.id,
      });
    }
  }

  database.transaction((transaction) => {
    for (const term of termRows.values()) {
      transaction
        .insert(terms)
        .values(term)
        .onConflictDoUpdate({
          set: {
            archivedAt: term.archivedAt,
            endDate: term.endDate,
            name: term.name,
            startDate: term.startDate,
          },
          target: terms.termCode,
        })
        .run();
    }

    for (const professor of professorRows.values()) {
      transaction
        .insert(professors)
        .values(professor)
        .onConflictDoUpdate({
          set: { name: professor.name },
          target: professors.id,
        })
        .run();
    }

    const previousSections = transaction
      .select({ id: sections.id })
      .from(sections)
      .where(eq(sections.courseId, pendingImport.courseId))
      .all();
    const previousSectionIds = [
      ...new Set(previousSections.map(({ id }) => id)),
    ];

    if (previousSectionIds.length > 0) {
      transaction
        .delete(sectionProfessors)
        .where(inArray(sectionProfessors.sectionId, previousSectionIds))
        .run();
    }

    transaction
      .delete(sections)
      .where(eq(sections.courseId, pendingImport.courseId))
      .run();

    if (sectionRows.length > 0) {
      transaction.insert(sections).values(sectionRows).run();
    }

    if (sectionProfessorRows.size > 0) {
      transaction
        .insert(sectionProfessors)
        .values([...sectionProfessorRows.values()])
        .run();
    }

    transaction
      .update(courseMatchingSections)
      .set({ importedAt })
      .where(
        inArray(courseMatchingSections.id, pendingImport.matchingSectionIds)
      )
      .run();
  });

  return {
    professors: professorRows.size,
    sectionProfessors: sectionProfessorRows.size,
    sections: sectionRows.length,
    terms: termRows.size,
  };
}

export async function importSectionDetails({
  database = db,
  extractor,
  importedAt = new Date(),
}: ImportSectionDetailsOptions) {
  const pendingRows = await database
    .select({
      courseId: courseMatchingSections.courseId,
      id: courseMatchingSections.id,
      sectionIds: courseMatchingSections.sectionIds,
    })
    .from(courseMatchingSections)
    .where(
      and(
        isNull(courseMatchingSections.archivedAt),
        isNull(courseMatchingSections.importedAt)
      )
    );
  const pendingImports = groupPendingImports(pendingRows);
  const imported = {
    courses: 0,
    matchingSections: 0,
    professors: 0,
    sectionProfessors: 0,
    sections: 0,
    terms: 0,
  };

  for (const pendingImport of pendingImports) {
    const sectionIds = [...pendingImport.sectionIds];
    let acadiaSections: AcadiaSection[] = [];

    if (sectionIds.length > 0) {
      // Keep portal requests sequential so a full import does not burst traffic.
      const sectionDetailsResult =
        // oxlint-disable-next-line no-await-in-loop
        await extractor.getSectionDetails(pendingImport.courseId, sectionIds);

      if (sectionDetailsResult.isErr()) {
        throw new Error(
          `Could not import section details for course ${pendingImport.courseId}: ${sectionDetailsResult.error.message}`,
          { cause: sectionDetailsResult.error }
        );
      }

      acadiaSections = validateSections(
        sectionDetailsResult.value,
        pendingImport
      );
    }

    const counts = persistCourseImport(
      database,
      pendingImport,
      acadiaSections,
      importedAt
    );

    imported.courses += 1;
    imported.matchingSections += pendingImport.matchingSectionIds.length;
    imported.professors += counts.professors;
    imported.sectionProfessors += counts.sectionProfessors;
    imported.sections += counts.sections;
    imported.terms += counts.terms;
  }

  return imported;
}
