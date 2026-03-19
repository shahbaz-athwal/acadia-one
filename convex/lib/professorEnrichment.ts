import { z } from "zod";

export const FacultyProfessorSchema = z.object({
  prefix: z.string(),
  department: z.string(),
  source_url: z.string(),
  name: z.string(),
  title: z.string(),
  email: z.string(),
  phone: z.string(),
  profile_url: z.string(),
  profile_image_url: z.string(),
  research_areas: z.array(z.string()),
  office: z.string(),
  description: z.string(),
});

export const FacultyDepartmentSchema = z.object({
  prefix: z.string(),
  department: z.string(),
  input_url: z.string(),
  status: z.enum(["success", "partial", "failed"]),
  visited_urls: z.array(z.string()),
  warnings: z.array(z.string()),
  professors: z.array(FacultyProfessorSchema),
});

export const FacultyProfessorDirectorySchema = z.object({
  generated_at: z.string(),
  model: z.string(),
  departments: z.array(FacultyDepartmentSchema),
});

export type FacultyProfessor = z.infer<typeof FacultyProfessorSchema>;
export type FacultyDepartment = z.infer<typeof FacultyDepartmentSchema>;
export type FacultyProfessorDirectory = z.infer<
  typeof FacultyProfessorDirectorySchema
>;

export interface DbProfessorMatchCandidate {
  externalId: string;
  name: string;
  departmentPrefix: string;
}

export interface ProfessorFacultyEnrichmentPatch {
  designation?: string;
  officeLocation?: string;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  imageUrl?: string;
  description?: string;
  researchAreas?: string[];
  sourceUrl?: string;
  lastFacultyEnrichedAt: number;
}

export interface DeterministicProfessorMatch {
  externalId: string;
  professor: FacultyProfessor;
}

export interface AgentProfessorMatch {
  jsonName: string;
  matchedExternalId: string | null;
  confidence: "high" | "low" | "none";
  reason: string;
}

export interface DeterministicMatchResolution {
  autoMatches: DeterministicProfessorMatch[];
  unresolved: FacultyProfessor[];
}

export interface FacultyEnrichmentUpdate
  extends ProfessorFacultyEnrichmentPatch {
  externalId: string;
}

export interface FacultyEnrichmentResolution {
  updates: FacultyEnrichmentUpdate[];
  agentMatched: number;
  skippedNoMatch: number;
  skippedLowConfidence: number;
  skippedNoData: number;
  unmatchedNames: string[];
}

const HONORIFIC_RE =
  /\b(?:dr|prof|professor|mr|mrs|ms|rev|reverend|fr|father)\.?\b/gi;
const DEGREE_RE =
  /\b(?:ph\.?\s*d\.?|p\.?\s*stat\.?|m\.?\s*sc\.?|m\.?\s*a\.?|m\.?\s*ed\.?|b\.?\s*ed\.?|m\.?\s*b\.?\s*a\.?|mlt)\b/gi;
const HTML_ANGLE_BRACKETS_RE = /[<>]/;
const ENCODED_HTML_ANGLE_BRACKETS_RE = /%3c|%3e/i;

export function cleanOptionalString(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function sanitizeUrl(value: string | null | undefined) {
  const cleaned = cleanOptionalString(value);
  if (!cleaned) {
    return undefined;
  }
  if (
    HTML_ANGLE_BRACKETS_RE.test(cleaned) ||
    ENCODED_HTML_ANGLE_BRACKETS_RE.test(cleaned)
  ) {
    return undefined;
  }

  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function dedupeResearchAreas(values: string[] | null | undefined) {
  if (!values) {
    return undefined;
  }

  const deduped = [
    ...new Set(values.map((value) => cleanOptionalString(value))),
  ].filter((value): value is string => value !== undefined);

  return deduped.length > 0 ? deduped : undefined;
}

export function normalizeProfessorName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(DEGREE_RE, " ")
    .replace(HONORIFIC_RE, " ")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildEnrichmentPatch(
  professor: FacultyProfessor,
  lastFacultyEnrichedAt: number
): ProfessorFacultyEnrichmentPatch {
  const patch = {
    designation: cleanOptionalString(professor.title),
    officeLocation: cleanOptionalString(professor.office),
    email: cleanOptionalString(professor.email),
    phone: cleanOptionalString(professor.phone),
    websiteUrl: sanitizeUrl(professor.profile_url),
    imageUrl: sanitizeUrl(professor.profile_image_url),
    description: cleanOptionalString(professor.description),
    researchAreas: dedupeResearchAreas(professor.research_areas),
    sourceUrl: sanitizeUrl(professor.source_url),
    lastFacultyEnrichedAt,
  };

  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as unknown as ProfessorFacultyEnrichmentPatch;
}

export function hasUsableEnrichmentData(
  patch: ProfessorFacultyEnrichmentPatch
) {
  return Object.entries(patch).some(([key, value]) => {
    if (key === "lastFacultyEnrichedAt" || value === undefined) {
      return false;
    }
    return !Array.isArray(value) || value.length > 0;
  });
}

export function shouldProcessFacultyDepartment(department: FacultyDepartment) {
  return (
    department.status !== "failed" &&
    department.professors.length > 0 &&
    department.prefix.trim().length > 0
  );
}

export function resolveDeterministicMatches(
  professors: FacultyProfessor[],
  dbProfessors: DbProfessorMatchCandidate[],
  departmentPrefix: string
): DeterministicMatchResolution {
  const dbByNormalizedName = new Map<string, DbProfessorMatchCandidate[]>();

  for (const professor of dbProfessors) {
    const normalizedName = normalizeProfessorName(professor.name);
    const existing = dbByNormalizedName.get(normalizedName) ?? [];
    existing.push(professor);
    dbByNormalizedName.set(normalizedName, existing);
  }

  const autoMatches: DeterministicProfessorMatch[] = [];
  const unresolved: FacultyProfessor[] = [];

  for (const professor of professors) {
    const normalizedName = normalizeProfessorName(professor.name);
    const candidates = dbByNormalizedName.get(normalizedName) ?? [];

    if (candidates.length !== 1) {
      unresolved.push(professor);
      continue;
    }

    const [candidate] = candidates;
    if (candidate.departmentPrefix !== departmentPrefix) {
      unresolved.push(professor);
      continue;
    }

    autoMatches.push({
      externalId: candidate.externalId,
      professor,
    });
  }

  return {
    autoMatches,
    unresolved,
  };
}

export function buildAgentCandidatePool(
  professors: FacultyProfessor[],
  dbProfessors: DbProfessorMatchCandidate[],
  departmentPrefix: string
) {
  const unresolvedNames = new Set(
    professors.map((professor) => normalizeProfessorName(professor.name))
  );

  return dbProfessors.filter((professor) => {
    if (professor.departmentPrefix === departmentPrefix) {
      return true;
    }
    return unresolvedNames.has(normalizeProfessorName(professor.name));
  });
}

export function resolveFacultyEnrichmentUpdates(args: {
  autoMatches: DeterministicProfessorMatch[];
  unresolved: FacultyProfessor[];
  agentMatches: AgentProfessorMatch[];
  allowedExternalIds: Set<string>;
  timestamp: number;
}): FacultyEnrichmentResolution {
  const agentMatchesByName = new Map<string, AgentProfessorMatch[]>();

  for (const match of args.agentMatches) {
    const existing = agentMatchesByName.get(match.jsonName) ?? [];
    existing.push(match);
    agentMatchesByName.set(match.jsonName, existing);
  }

  const updates: FacultyEnrichmentUpdate[] = [];
  const unmatchedNames: string[] = [];
  let agentMatched = 0;
  let skippedNoMatch = 0;
  let skippedLowConfidence = 0;
  let skippedNoData = 0;

  for (const match of args.autoMatches) {
    const patch = buildEnrichmentPatch(match.professor, args.timestamp);
    if (!hasUsableEnrichmentData(patch)) {
      skippedNoData += 1;
      continue;
    }
    updates.push({
      externalId: match.externalId,
      ...patch,
    });
  }

  for (const professor of args.unresolved) {
    const possibleMatches = agentMatchesByName.get(professor.name) ?? [];
    const agentMatch = possibleMatches.shift();

    if (possibleMatches.length === 0) {
      agentMatchesByName.delete(professor.name);
    } else {
      agentMatchesByName.set(professor.name, possibleMatches);
    }

    if (!agentMatch?.matchedExternalId) {
      skippedNoMatch += 1;
      unmatchedNames.push(professor.name);
      continue;
    }

    if (
      agentMatch.confidence !== "high" ||
      !args.allowedExternalIds.has(agentMatch.matchedExternalId)
    ) {
      skippedLowConfidence += 1;
      unmatchedNames.push(professor.name);
      continue;
    }

    agentMatched += 1;
    const patch = buildEnrichmentPatch(professor, args.timestamp);
    if (!hasUsableEnrichmentData(patch)) {
      skippedNoData += 1;
      continue;
    }

    updates.push({
      externalId: agentMatch.matchedExternalId,
      ...patch,
    });
  }

  return {
    updates,
    agentMatched,
    skippedNoMatch,
    skippedLowConfidence,
    skippedNoData,
    unmatchedNames,
  };
}
