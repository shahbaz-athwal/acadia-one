import { describe, expect, test } from "bun:test";
import { getExistingRatingLookup } from "./ratingIdentity";

describe("getExistingRatingLookup", () => {
  test("prefers the RMP rating id over professor-level fields", () => {
    expect(
      getExistingRatingLookup({
        rmpId: "rating-123",
        rmpLegacyId: 456,
      })
    ).toEqual({
      indexName: "by_rmpId",
      value: "rating-123",
    });
  });

  test("falls back to the legacy id when needed", () => {
    expect(
      getExistingRatingLookup({
        rmpLegacyId: 456,
      })
    ).toEqual({
      indexName: "by_rmpLegacyId",
      value: 456,
    });
  });

  test("returns null when no rating identity exists", () => {
    expect(getExistingRatingLookup({})).toBeNull();
  });
});
