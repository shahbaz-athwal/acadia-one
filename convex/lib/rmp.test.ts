import { describe, expect, test } from "bun:test";
import { collectPaginatedRatings } from "./rmp";

describe("collectPaginatedRatings", () => {
  test("follows all cursors until the final page", async () => {
    const cursors: Array<string | undefined> = [];

    const ratings = await collectPaginatedRatings(async (cursor) => {
      cursors.push(cursor);

      if (!cursor) {
        return {
          ratings: [{ id: "1" }, { id: "2" }],
          paging: { hasNextPage: true, endCursor: "page-2" },
        };
      }

      if (cursor === "page-2") {
        return {
          ratings: [{ id: "3" }],
          paging: { hasNextPage: true, endCursor: "page-3" },
        };
      }

      return {
        ratings: [{ id: "4" }],
        paging: { hasNextPage: false, endCursor: null },
      };
    });

    expect(cursors).toEqual([undefined, "page-2", "page-3"]);
    expect(ratings).toEqual([
      { id: "1" },
      { id: "2" },
      { id: "3" },
      { id: "4" },
    ]);
  });
});
