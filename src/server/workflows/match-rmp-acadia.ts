import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import type { Database } from "@/db";
import { departments, professorDepartments, professors } from "@/db/schema";
import type { ProfessorId } from "@/db/schema";
import { searchTeachersBySchoolId } from "@/server/rmp/extractor";
import type { RmpTeacher } from "@/server/rmp/extractor";
import { jaroWinkler, normalizeName } from "@/server/rmp/normalize";

/**
 * Cost is irrelevant here — a full run is a few cents and it runs once, then the
 * result is frozen into the committed catalog snapshot — so this is the
 * strongest model rather than the cheapest.
 */
export const MATCHING_MODEL_ID = "gemini-3.1-pro-preview";

/** Accept a fuzzy match only when it is both strong and unrivalled. */
const FUZZY_ACCEPT_SCORE = 0.93;
const FUZZY_ACCEPT_MARGIN = 0.03;

/** Anything this close is worth showing the model, even if it looks wrong. */
const SHORTLIST_MIN_SCORE = 0.72;
const SHORTLIST_SIZE = 8;

export type MatchMethod = "exact" | "initial" | "fuzzy" | "ai" | "unmatched";

const METHOD_PRECEDENCE: Record<MatchMethod, number> = {
  exact: 4,
  initial: 3,
  fuzzy: 2,
  ai: 1,
  unmatched: 0,
};

export interface ProfessorMatch {
  readonly method: MatchMethod;
  readonly professorId: ProfessorId;
  readonly professorName: string;
  readonly reason: string;
  readonly rmpId: string | null;
  readonly rmpLegacyId: number | null;
}

interface LocalProfessor {
  readonly departmentNames: readonly string[];
  readonly id: ProfessorId;
  readonly name: string;
}

interface TeacherIndex {
  readonly byExactKey: ReadonlyMap<string, RmpTeacher[]>;
  readonly byInitialKey: ReadonlyMap<string, RmpTeacher[]>;
  readonly scored: readonly { full: string; teacher: RmpTeacher }[];
}

function pushKey(
  index: Map<string, RmpTeacher[]>,
  key: string,
  teacher: RmpTeacher
) {
  const existing = index.get(key);

  if (existing === undefined) {
    index.set(key, [teacher]);
    return;
  }

  existing.push(teacher);
}

function indexTeachers(teachers: readonly RmpTeacher[]): TeacherIndex {
  const byExactKey = new Map<string, RmpTeacher[]>();
  const byInitialKey = new Map<string, RmpTeacher[]>();
  const scored: { full: string; teacher: RmpTeacher }[] = [];

  for (const teacher of teachers) {
    const name = normalizeName(`${teacher.firstName} ${teacher.lastName}`);

    if (name.first.length === 0) {
      continue;
    }

    for (const variant of name.lastVariants) {
      pushKey(byExactKey, `${name.first}|${variant}`, teacher);
      pushKey(byInitialKey, `${name.first.slice(0, 1)}|${variant}`, teacher);
    }

    scored.push({ full: name.full, teacher });
  }

  return { byExactKey, byInitialKey, scored };
}

function lookupUnique(
  index: ReadonlyMap<string, RmpTeacher[]>,
  keys: readonly string[]
): RmpTeacher[] {
  const found = new Map<string, RmpTeacher>();

  for (const key of keys) {
    for (const teacher of index.get(key) ?? []) {
      found.set(teacher.id, teacher);
    }
  }

  return [...found.values()];
}

interface ProfessorDecision {
  readonly match?: ProfessorMatch;
  readonly shortlist: readonly RmpTeacher[];
}

function decide(
  professor: LocalProfessor,
  index: TeacherIndex
): ProfessorDecision {
  const name = normalizeName(professor.name);
  const base = {
    professorId: professor.id,
    professorName: professor.name,
  };

  if (name.first.length === 0) {
    return { shortlist: [] };
  }

  const exactKeys = [...name.lastVariants].map(
    (variant) => `${name.first}|${variant}`
  );
  const exact = lookupUnique(index.byExactKey, exactKeys);

  if (exact.length === 1) {
    const [teacher] = exact;

    return {
      match: {
        ...base,
        method: "exact",
        reason: `Exact name match with ${teacher.firstName} ${teacher.lastName}.`,
        rmpId: teacher.id,
        rmpLegacyId: teacher.legacyId,
      },
      shortlist: [],
    };
  }

  if (exact.length > 1) {
    return { shortlist: exact };
  }

  const initialKeys = [...name.lastVariants].map(
    (variant) => `${name.first.slice(0, 1)}|${variant}`
  );
  const initial = lookupUnique(index.byInitialKey, initialKeys);

  if (initial.length === 1) {
    const [teacher] = initial;

    return {
      match: {
        ...base,
        method: "initial",
        reason: `Surname and first initial match ${teacher.firstName} ${teacher.lastName}.`,
        rmpId: teacher.id,
        rmpLegacyId: teacher.legacyId,
      },
      shortlist: [],
    };
  }

  const ranked = index.scored
    .map((entry) => ({
      score: jaroWinkler(name.full, entry.full),
      teacher: entry.teacher,
    }))
    .toSorted((left, right) => right.score - left.score);

  const [best, runnerUp] = ranked;

  if (
    initial.length === 0 &&
    best !== undefined &&
    best.score >= FUZZY_ACCEPT_SCORE &&
    best.score - (runnerUp?.score ?? 0) >= FUZZY_ACCEPT_MARGIN
  ) {
    return {
      match: {
        ...base,
        method: "fuzzy",
        reason: `Near-identical spelling of ${best.teacher.firstName} ${best.teacher.lastName} (${best.score.toFixed(3)}).`,
        rmpId: best.teacher.id,
        rmpLegacyId: best.teacher.legacyId,
      },
      shortlist: [],
    };
  }

  const shortlist =
    initial.length > 1
      ? initial
      : ranked
          .filter((entry) => entry.score >= SHORTLIST_MIN_SCORE)
          .slice(0, SHORTLIST_SIZE)
          .map((entry) => entry.teacher);

  return { shortlist };
}

const AdjudicationSchema = z.object({
  matches: z.array(
    z.object({
      professorId: z.string(),
      rmpId: z.string().nullable(),
      reason: z.string(),
    })
  ),
});

const ADJUDICATION_PROMPT = `You are linking Acadia University professor records to Rate My Professors profiles.

For each professor below you are given a shortlist of candidate RMP profiles that a name matcher could not settle on its own. Decide which candidate, if any, is the same person.

Rules:
- Return exactly one entry for every professor listed, using their professorId verbatim.
- Use the candidate's RMP_ID verbatim, or null when no candidate is the same person.
- Prefer null over a guess. A wrong link is far worse than a missing one.
- Given names may differ in form (Rene/René, Lance/Lawrence, Bill/William) and surnames may be misspelled on RMP. Those are still matches when everything else agrees.
- A different given name with a similar surname is NOT a match (e.g. "Susan Barratt" is not "Paul Barrett").
- A candidate whose surname matches the professor's GIVEN name is NOT a match (e.g. "Glen E. Berry" is not "Katherine Glen").
- The department is a supporting signal, not a requirement: RMP departments are free text entered by students and are often wrong or coarse.
- Give a one-line reason for every decision.`;

function formatCandidates(
  professor: LocalProfessor,
  shortlist: readonly RmpTeacher[]
) {
  const departmentLabel =
    professor.departmentNames.length > 0
      ? professor.departmentNames.join(", ")
      : "unknown department";
  const candidates = shortlist
    .map(
      (teacher) =>
        `    - RMP_ID: ${teacher.id} | ${teacher.firstName} ${teacher.lastName} | ${teacher.department}`
    )
    .join("\n");

  return `- professorId: ${professor.id} | ${professor.name} | ${departmentLabel}\n${candidates}`;
}

async function adjudicate(
  unresolved: readonly {
    professor: LocalProfessor;
    shortlist: readonly RmpTeacher[];
  }[]
) {
  const prompt = `${ADJUDICATION_PROMPT}

Professors and their candidates:
${unresolved.map((entry) => formatCandidates(entry.professor, entry.shortlist)).join("\n")}
`;

  return await generateText({
    model: google(MATCHING_MODEL_ID),
    output: Output.object({ schema: AdjudicationSchema }),
    prompt,
  });
}

/**
 * Two professors cannot be the same RMP profile. When the matcher produces a
 * collision the weaker method loses, because `exact` is derived from the data
 * and `ai` is a judgement call.
 */
function resolveCollisions(
  matches: readonly ProfessorMatch[]
): ProfessorMatch[] {
  const winnerByRmpId = new Map<string, ProfessorMatch>();

  for (const match of matches) {
    if (match.rmpId === null) {
      continue;
    }

    const incumbent = winnerByRmpId.get(match.rmpId);

    if (
      incumbent === undefined ||
      METHOD_PRECEDENCE[match.method] > METHOD_PRECEDENCE[incumbent.method]
    ) {
      winnerByRmpId.set(match.rmpId, match);
    }
  }

  return matches.map((match) => {
    if (match.rmpId === null) {
      return match;
    }

    const winner = winnerByRmpId.get(match.rmpId);

    if (winner === undefined || winner.professorId === match.professorId) {
      return match;
    }

    return {
      ...match,
      method: "unmatched" as const,
      reason: `Dropped: RMP profile ${match.rmpId} was claimed more strongly by ${winner.professorName} (${winner.method}).`,
      rmpId: null,
      rmpLegacyId: null,
    };
  });
}

async function loadProfessors(database: Database): Promise<LocalProfessor[]> {
  const rows = await database
    .select({
      departmentName: departments.name,
      id: professors.id,
      name: professors.name,
    })
    .from(professors)
    .leftJoin(
      professorDepartments,
      eq(professorDepartments.professorId, professors.id)
    )
    .leftJoin(
      departments,
      eq(departments.prefix, professorDepartments.departmentPrefix)
    );

  const byId = new Map<
    ProfessorId,
    { departmentNames: string[]; id: ProfessorId; name: string }
  >();

  for (const row of rows) {
    const existing = byId.get(row.id);

    if (existing === undefined) {
      byId.set(row.id, {
        departmentNames:
          row.departmentName === null ? [] : [row.departmentName],
        id: row.id,
        name: row.name,
      });
      continue;
    }

    if (row.departmentName !== null) {
      existing.departmentNames.push(row.departmentName);
    }
  }

  return [...byId.values()];
}

export interface MatchRmpOptions {
  readonly database?: Database;
  /** Skip the model and keep only what the name matcher settles on its own. */
  readonly deterministicOnly?: boolean;
  /** Compute matches without writing them. */
  readonly dryRun?: boolean;
  readonly teachers?: readonly RmpTeacher[];
}

export interface MatchRmpReport {
  readonly byMethod: Record<MatchMethod, number>;
  readonly matches: readonly ProfessorMatch[];
  readonly professors: number;
  readonly teachers: number;
  readonly usage: {
    readonly inputTokens: number;
    readonly model: string;
    readonly outputTokens: number;
  } | null;
  readonly written: number;
}

async function fetchTeachers(provided: readonly RmpTeacher[] | undefined) {
  if (provided !== undefined) {
    return provided;
  }

  const result = await searchTeachersBySchoolId();

  if (result.isErr()) {
    throw new Error(result.error.message, { cause: result.error });
  }

  return result.value;
}

interface Unresolved {
  readonly professor: LocalProfessor;
  readonly shortlist: readonly RmpTeacher[];
}

function partition(
  localProfessors: readonly LocalProfessor[],
  index: TeacherIndex,
  deterministicOnly: boolean
) {
  const settled: ProfessorMatch[] = [];
  const unresolved: Unresolved[] = [];

  for (const professor of localProfessors) {
    const decision = decide(professor, index);

    if (decision.match !== undefined) {
      settled.push(decision.match);
      continue;
    }

    if (decision.shortlist.length > 0 && !deterministicOnly) {
      unresolved.push({ professor, shortlist: decision.shortlist });
      continue;
    }

    settled.push({
      method: "unmatched",
      professorId: professor.id,
      professorName: professor.name,
      reason:
        decision.shortlist.length === 0
          ? "No plausible RMP profile."
          : `${decision.shortlist.length} candidates, model adjudication skipped.`,
      rmpId: null,
      rmpLegacyId: null,
    });
  }

  return { settled, unresolved };
}

async function applyAdjudication(
  unresolved: readonly Unresolved[],
  teachers: readonly RmpTeacher[]
) {
  const result = await adjudicate(unresolved);
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const decisionsById = new Map(
    result.output.matches.map((match) => [match.professorId, match])
  );
  const matches: ProfessorMatch[] = [];

  for (const entry of unresolved) {
    const decision = decisionsById.get(entry.professor.id);
    const rmpId = decision?.rmpId ?? null;
    // An id the model invented rather than copied resolves to nothing here, so
    // a hallucinated profile degrades to `unmatched` instead of being written.
    const teacher = rmpId === null ? undefined : teacherById.get(rmpId);

    matches.push({
      method: teacher === undefined ? "unmatched" : "ai",
      professorId: entry.professor.id,
      professorName: entry.professor.name,
      reason:
        decision?.reason ??
        "The model returned no decision for this professor.",
      rmpId: teacher?.id ?? null,
      rmpLegacyId: teacher?.legacyId ?? null,
    });
  }

  return {
    matches,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      model: MATCHING_MODEL_ID,
      outputTokens: result.usage.outputTokens ?? 0,
    },
  };
}

/**
 * A full run rewrites every professor, including the unmatched ones: it is a
 * reconciliation of the whole roster, and a link the matcher no longer stands
 * behind has to be cleared or a stale id survives forever in the committed
 * snapshot. `deterministicOnly` is deliberately a partial view of the roster,
 * so it only ever adds — otherwise it would wipe every match the model made on
 * a previous full run.
 */
function persist(
  database: Database,
  matches: readonly ProfessorMatch[],
  deterministicOnly: boolean
) {
  let written = 0;

  database.transaction((transaction) => {
    for (const match of matches) {
      if (match.rmpId === null && deterministicOnly) {
        continue;
      }

      transaction
        .update(professors)
        .set({ rmpId: match.rmpId, rmpLegacyId: match.rmpLegacyId })
        .where(eq(professors.id, match.professorId))
        .run();

      if (match.rmpId !== null) {
        written += 1;
      }
    }
  });

  return written;
}

function tally(matches: readonly ProfessorMatch[]) {
  const byMethod: Record<MatchMethod, number> = {
    exact: 0,
    initial: 0,
    fuzzy: 0,
    ai: 0,
    unmatched: 0,
  };

  for (const match of matches) {
    byMethod[match.method] += 1;
  }

  return byMethod;
}

export async function matchRmpToAcadia({
  database = getDatabase(),
  deterministicOnly = false,
  dryRun = false,
  teachers: providedTeachers,
}: MatchRmpOptions = {}): Promise<MatchRmpReport> {
  const teachers = await fetchTeachers(providedTeachers);
  const localProfessors = await loadProfessors(database);
  const { settled, unresolved } = partition(
    localProfessors,
    indexTeachers(teachers),
    deterministicOnly
  );

  let usage: MatchRmpReport["usage"] = null;

  if (unresolved.length > 0) {
    const adjudicated = await applyAdjudication(unresolved, teachers);

    settled.push(...adjudicated.matches);
    ({ usage } = adjudicated);
  }

  const matches = resolveCollisions(settled);

  return {
    byMethod: tally(matches),
    matches,
    professors: localProfessors.length,
    teachers: teachers.length,
    usage,
    written: dryRun ? 0 : persist(database, matches, deterministicOnly),
  };
}
