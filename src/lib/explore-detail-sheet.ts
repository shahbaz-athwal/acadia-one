export type ExploreDetailTarget =
  | {
      kind: "course";
      courseCode: string;
    }
  | {
      kind: "professor";
      professorExternalId: string;
    };

export function parseDetailTarget(value: string | null | undefined): ExploreDetailTarget | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("prof-")) {
    const professorExternalId = trimmed.slice("prof-".length).trim();
    if (!professorExternalId) {
      return null;
    }
    return {
      kind: "professor",
      professorExternalId,
    };
  }

  return {
    kind: "course",
    courseCode: trimmed.toUpperCase(),
  };
}

export function formatDetailTarget(target: ExploreDetailTarget): string {
  if (target.kind === "professor") {
    return `prof-${target.professorExternalId}`;
  }

  return target.courseCode.trim().toUpperCase();
}
