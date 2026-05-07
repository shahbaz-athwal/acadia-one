export function getExistingRatingLookup(
  rating: { rmpId?: string; rmpLegacyId?: number } | null | undefined,
) {
  if (rating?.rmpId) {
    return {
      indexName: "by_rmpId" as const,
      value: rating.rmpId,
    };
  }

  if (rating?.rmpLegacyId !== undefined) {
    return {
      indexName: "by_rmpLegacyId" as const,
      value: rating.rmpLegacyId,
    };
  }

  return null;
}
