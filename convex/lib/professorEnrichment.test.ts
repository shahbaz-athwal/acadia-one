import { describe, expect, test } from "bun:test";
import {
  buildEnrichmentPatch,
  hasUsableEnrichmentData,
  normalizeProfessorName,
  sanitizeUrl,
} from "./professorEnrichment";

describe("professorEnrichment helpers", () => {
  test("normalizes honorifics and degree suffixes", () => {
    expect(normalizeProfessorName("Dr Trevor Avery")).toBe(
      normalizeProfessorName("Trevor Avery, Ph.D., P.Stat.")
    );
  });

  test("normalizes accents and punctuation", () => {
    expect(normalizeProfessorName("Hélène d'Entremont, M.Sc. MLT")).toBe(
      normalizeProfessorName("Helene D'Entremont")
    );
  });

  test("rejects malformed URLs", () => {
    expect(sanitizeUrl("https://womenstudies.acadiau.ca/%3Cdiv%3E%C2%A0")).toBe(
      undefined
    );
  });

  test("detects patches without usable enrichment data", () => {
    const patch = buildEnrichmentPatch(
      {
        prefix: "COOP",
        department: "Cooperative Education",
        source_url: "",
        name: "Empty Professor",
        title: "",
        email: "",
        phone: "",
        profile_url: "",
        profile_image_url: "",
        research_areas: [],
        office: "",
        description: "",
      },
      123
    );

    expect(hasUsableEnrichmentData(patch)).toBe(false);
  });
});
