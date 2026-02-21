# Academic Level Filter

## Current State

### Course Code Format

Course codes follow the pattern `PREFIX + NUMBER` (e.g. `COMP3456`, `ART2056`, `MATH1013`). The **first digit** of the numeric part indicates the academic level.

### Existing Regex for Code Parsing

Two regexes exist in the codebase:

1. **`convex/internal.ts`** line 293 — `buildSearchText`:
   ```ts
   course.code.match(/([A-Z]+|\d+)/g)?.join("-") ?? course.code
   ```
   Splits into letter + digit groups: `"COMP3456"` → `["COMP", "3456"]`.  
   **Reusable**: Take the digit group, extract first character → level.

2. **`convex/acadia/schemas/postSearchCriteria.ts`**:
   ```ts
   /\b([A-Z]{2,6})\s*(?:-\s*|\s+)?([0-9]{3,4}[A-Z]?)\b/gi
   ```
   Captures subject prefix and course number (3–4 digits + optional trailing letter).

### Level Extraction

```ts
function getAcademicLevel(code: string): number {
  const parts = code.match(/([A-Z]+|\d+)/g);
  if (!parts || parts.length < 2) return 0;
  const numericPart = parts.find(p => /^\d/.test(p));
  if (!numericPart) return 0;
  return parseInt(numericPart[0], 10);
}
```

Examples:
- `COMP3456` → `["COMP", "3456"]` → first digit `3` → level 3 (Third Year)
- `ART2056` → `["ART", "2056"]` → first digit `2` → level 2 (Second Year)
- `MATH1013` → level 1 (First Year)
- `GEND5003` → level 5 (Graduate 5000)
- `DIVN8003` → level 8 (Post-Baccalaureate)

### Academic Level Mapping

| Level | Label | Course Number Range |
|-------|-------|-------------------|
| 0 | Pre-University | 0xxx |
| 1 | First Year | 1xxx |
| 2 | Second Year | 2xxx |
| 3 | Third Year | 3xxx |
| 4 | Fourth Year | 4xxx |
| 5 | Graduate 5000-level | 5xxx |
| 6 | Graduate 6000-level | 6xxx |
| 7 | Graduate 7000-level | 7xxx |
| 8 | Post-Baccalaureate 8000-level | 8xxx |
| 9 | Transfer Course 9000-level | 9xxx |

## Proposed Changes

### 1. Schema — `convex/schema.ts`

Add `academicLevel` field to the `courses` table:

```ts
academicLevel: v.optional(v.number()),  // 0–9, derived from first digit of course number
```

Use `v.optional()` to avoid breaking existing docs during migration.

### 2. Level Parser — `convex/internal.ts`

Add a helper function (reuses the existing `buildSearchText` regex pattern):

```ts
function getAcademicLevel(code: string): number {
  const parts = code.match(/([A-Z]+|\d+)/g);
  if (!parts) return 0;
  const numericPart = parts.find(p => /^\d/.test(p));
  if (!numericPart) return 0;
  return parseInt(numericPart[0], 10);
}
```

### 3. Update `upsertCourses` — `convex/internal.ts`

In the `upsertCourses` handler, compute `academicLevel` from `course.code` and include it in both the insert and patch paths:

```ts
const academicLevel = getAcademicLevel(course.code);
// ... include in patch/insert
```

### 4. Backfill Mutation — `convex/internal.ts`

Add `backfillAcademicLevel` mutation (follows the pattern of existing `backfillSearchText`):

```ts
export const backfillAcademicLevel = internalMutation({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    for (const course of courses) {
      await ctx.db.patch(course._id, {
        academicLevel: getAcademicLevel(course.code),
      });
    }
    return courses.length;
  },
});
```

### 5. Workflow — No changes needed

`processCourse.ts` doesn't create courses — it only creates sections and links. Course creation happens in `populate.ts` → `upsertCourses`. Since `upsertCourses` is being updated, the workflow automatically picks up the change.

### 6. URL Search Params — `src/routes/explore.tsx`

Add `lvl` param:

```ts
lvl: z.preprocess(parseNumberArray, z.array(z.number().int())).catch([]),
```

Add `lvl: []` to `SEARCH_DEFAULTS`.

### 7. Filter Hook — `src/hooks/use-explore-filters.ts`

- Add `academicLevels` to the filters object (reads from `search.lvl`).
- Add `setAcademicLevels` setter.

### 8. Filter Component — `src/components/explore/filters/academic-level-filter.tsx`

Checkbox group following `days-filter.tsx` pattern:

```tsx
const ACADEMIC_LEVELS = [
  { value: 0, label: "Pre-University" },
  { value: 1, label: "First Year" },
  { value: 2, label: "Second Year" },
  { value: 3, label: "Third Year" },
  { value: 4, label: "Fourth Year" },
  { value: 5, label: "Graduate 5000-level" },
  { value: 6, label: "Graduate 6000-level" },
  { value: 7, label: "Graduate 7000-level" },
  { value: 8, label: "Post-Baccalaureate 8000-level" },
  { value: 9, label: "Transfer Course 9000-level" },
] as const;
```

### 9. Backend Filtering — `convex/courses.ts`

- Add `academicLevels: v.optional(v.array(v.number()))` to `listForExplore` args filter object.
- Add academic level to `applyPostFilters`: filter on `course.academicLevel`.

### 10. `buildConvexFilters` — `src/queries/explore.ts`

Add `academicLevels` when `lvl` is non-empty.

### 11. Filter Tab + Panel

Wire into `filters-tab.tsx`, update `hasFilters` / `clearFilters`, update badge count in `filter-panel.tsx`.

## Files to Modify

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `academicLevel` field to courses |
| `convex/internal.ts` | Add `getAcademicLevel` helper, update `upsertCourses`, add `backfillAcademicLevel` |
| `src/routes/explore.tsx` | Add `lvl` search param |
| `src/hooks/use-explore-filters.ts` | Add academic level state + setter |
| `src/components/explore/filters/academic-level-filter.tsx` | **New** — checkbox group |
| `src/components/explore/filters/filters-tab.tsx` | Add Academic Level section |
| `src/components/explore/filters/filter-panel.tsx` | Update filter count |
| `src/queries/explore.ts` | Add `academicLevels` to filter builder |
| `convex/courses.ts` | Add `academicLevels` filter arg + post-filter |
