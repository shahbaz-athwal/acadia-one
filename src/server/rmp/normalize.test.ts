import { describe, expect, test } from "bun:test";

import { jaroWinkler, lastNameVariants, normalizeName } from "./normalize";

describe("normalizeName", () => {
  test("drops honorifics and folds diacritics", () => {
    expect(normalizeName("Dr Sandra M. Barr").full).toBe("sandra m barr");
    expect(normalizeName("Dr René Murphy").full).toBe("rene murphy");
    expect(normalizeName("Prof Glyn C. Bissix").first).toBe("glyn");
  });

  test("drops trailing credentials", () => {
    expect(normalizeName("Kevin Kelloway, PhD").full).toBe("kevin kelloway");
  });
});

describe("lastNameVariants", () => {
  test("offers the compound reading of a split surname", () => {
    const variants = lastNameVariants(["lance", "b", "la", "rocque"]);

    expect(variants).toContain("rocque");
    expect(variants).toContain("larocque");
  });

  test("offers the leading half of a hyphenated surname", () => {
    const variants = lastNameVariants(["paula", "rockwell", "firth"]);

    expect(variants).toContain("firth");
    expect(variants).toContain("rockwell");
  });

  test("never treats a middle initial as a surname", () => {
    expect(lastNameVariants(["sandra", "m", "barr"])).not.toContain("m");
  });

  /**
   * Regression: without the token-count guard the given name of every
   * two-token name landed in the surname set, so all six "Ian ..." profiles on
   * RMP collided under `ian` and the whole group fell through to the model.
   */
  test("never treats the given name of a two-token name as a surname", () => {
    expect(lastNameVariants(["ian", "wilks"])).not.toContain("ian");
  });
});

describe("jaroWinkler", () => {
  test("rates a misspelt surname above an unrelated one", () => {
    const misspelt = jaroWinkler("liesel carlsson", "liesel carrlson");
    const unrelated = jaroWinkler("susan barratt", "paul barrett");

    expect(misspelt).toBeGreaterThan(unrelated);
  });

  test("is symmetric and bounded", () => {
    expect(jaroWinkler("abc", "abc")).toBe(1);
    expect(jaroWinkler("", "abc")).toBe(0);
    expect(jaroWinkler("martha", "marhta")).toBeCloseTo(
      jaroWinkler("marhta", "martha"),
      10
    );
  });
});
