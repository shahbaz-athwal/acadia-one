/**
 * Acadia stores display names ("Dr Sandra M. Barr", "Ms Paula Rockwell-Firth")
 * while RMP stores separate first/last fields. Everything here reduces both
 * sides to the same comparable shape so the bulk of the roster matches without
 * asking a model anything.
 */

const HONORIFICS: ReadonlySet<string> = new Set([
  "dr",
  "prof",
  "professor",
  "mr",
  "mrs",
  "ms",
  "miss",
  "rev",
  "fr",
  "sister",
  "father",
]);

const SUFFIXES: ReadonlySet<string> = new Set([
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "phd",
  "md",
  "ma",
  "msc",
  "bsc",
  "emeritus",
]);

/** Shortest token still treated as a name rather than a middle initial. */
const MIN_NAME_TOKEN_LENGTH = 3;

export interface NormalizedName {
  /** First given token, e.g. `sandra`. Empty when the name is a single token. */
  readonly first: string;
  /** Every plausible surname spelling. See `lastNameVariants`. */
  readonly lastVariants: ReadonlySet<string>;
  /** All tokens joined by a space, for fuzzy scoring. */
  readonly full: string;
  readonly tokens: readonly string[];
}

export function normalizeTokens(raw: string): string[] {
  return raw
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/gu, "")
    .toLowerCase()
    .split(/[^a-z']+/u)
    .map((token) => token.replaceAll("'", ""))
    .filter(
      (token) =>
        token.length > 0 && !(HONORIFICS.has(token) || SUFFIXES.has(token))
    );
}

/**
 * Acadia and RMP disagree about where a compound surname starts: "Lance B. La
 * Rocque" is "Lance Larocque" on RMP, and "Paula Rockwell-Firth" is "Paula
 * Rockwell". Emitting every reading lets a single exact-key lookup catch all
 * three spellings instead of needing a fuzzy pass.
 *
 * Two guards keep the set honest. The token count has to reach three before the
 * penultimate token can stand alone as a surname, because in a two-token name
 * it is the given name — without that, every "Ian <surname>" on RMP indexes
 * under `ian`, and "Ian Feltmate" then collides with six other Ians. The length
 * check keeps a middle initial out: "Sandra M. Barr" yields `barr` and `mbarr`,
 * never `m`.
 */
export function lastNameVariants(tokens: readonly string[]): Set<string> {
  const variants = new Set<string>();
  const count = tokens.length;

  if (count === 0) {
    return variants;
  }

  const last = tokens[count - 1] ?? "";

  variants.add(last);

  if (count >= 2) {
    const penultimate = tokens[count - 2] ?? "";

    variants.add(`${penultimate}${last}`);

    if (count >= 3 && penultimate.length >= MIN_NAME_TOKEN_LENGTH) {
      variants.add(penultimate);
    }
  }

  return variants;
}

export function normalizeName(raw: string): NormalizedName {
  const tokens = normalizeTokens(raw);

  return {
    first: tokens[0] ?? "",
    full: tokens.join(" "),
    lastVariants: lastNameVariants(tokens),
    tokens,
  };
}

const JARO_WINKLER_THRESHOLD = 0.7;
const JARO_WINKLER_PREFIX_SCALE = 0.1;
const JARO_WINKLER_MAX_PREFIX = 4;

function jaro(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const window = Math.max(
    0,
    Math.floor(Math.max(left.length, right.length) / 2) - 1
  );
  const leftMatched: boolean[] = Array.from(
    { length: left.length },
    () => false
  );
  const rightMatched: boolean[] = Array.from(
    { length: right.length },
    () => false
  );
  let matches = 0;

  for (let index = 0; index < left.length; index += 1) {
    const start = Math.max(0, index - window);
    const end = Math.min(index + window + 1, right.length);

    for (let other = start; other < end; other += 1) {
      if (!rightMatched[other] && left[index] === right[other]) {
        leftMatched[index] = true;
        rightMatched[other] = true;
        matches += 1;
        break;
      }
    }
  }

  if (matches === 0) {
    return 0;
  }

  let transpositions = 0;
  let cursor = 0;

  for (let index = 0; index < left.length; index += 1) {
    if (!leftMatched[index]) {
      continue;
    }

    while (!rightMatched[cursor]) {
      cursor += 1;
    }

    if (left[index] !== right[cursor]) {
      transpositions += 1;
    }

    cursor += 1;
  }

  const halfTranspositions = transpositions / 2;

  return (
    (matches / left.length +
      matches / right.length +
      (matches - halfTranspositions) / matches) /
    3
  );
}

/**
 * Jaro-Winkler rather than Levenshtein: it weights a shared prefix, which is
 * the right bias for person names ("carlsson"/"carrlson" scores far above
 * "barratt"/"barrett" under it, and the two are indistinguishable under edit
 * distance).
 */
export function jaroWinkler(left: string, right: string): number {
  const score = jaro(left, right);

  if (score < JARO_WINKLER_THRESHOLD) {
    return score;
  }

  let prefix = 0;

  while (
    prefix < JARO_WINKLER_MAX_PREFIX &&
    prefix < left.length &&
    prefix < right.length &&
    left[prefix] === right[prefix]
  ) {
    prefix += 1;
  }

  return score + prefix * JARO_WINKLER_PREFIX_SCALE * (1 - score);
}
