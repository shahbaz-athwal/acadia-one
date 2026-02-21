# Time Range Filter

## Current State

### Time Storage Format

Sections store `classStartTime` and `classEndTime` as **strings** in the DB (`convex/schema.ts` lines 228–229). Values come from Acadia's `StartTimeDisplay` / `EndTimeDisplay` — typically 12hr format like `"10:00 AM"`, `"2:30 PM"`.

### Time Parsing Utilities

`src/lib/schedule-time.ts` already has:

- **`parseTimeToMinutes(time: string): number`** — Converts `"10:00 AM"` → `600`, `"2:30 PM"` → `870`. Supports both 12hr and 24hr formats.
- **`formatTime(minutes: number): string`** — Converts `600` → `"10:00 AM"`. Outputs 12hr format.
- **`GRID_START_MINUTES`** = `450` (7:30 AM)
- **`GRID_END_MINUTES`** = `1290` (9:30 PM)

### Existing Filter Pattern

All filters follow the same pattern:
1. URL search param (validated with Zod in `src/routes/explore.tsx`)
2. Hook state in `src/hooks/use-explore-filters.ts` (reads via `routeApi.useSearch`, writes via `navigate`)
3. Filter component in `src/components/explore/filters/`
4. Filter builder in `src/queries/explore.ts` (`buildConvexFilters`)
5. Backend filtering in `convex/courses.ts` (`applyPostFilters` or index-based)

### Denormalized Course Filter Fields

Courses have denormalized fields for post-filtering: `sectionTermCodes`, `sectionProfessorIds`, `sectionDays`. A similar approach could work for time ranges, but since time range is a continuous range (not discrete values), **post-filtering at the section level** during `enrichWithSections` is more appropriate.

## Proposed Changes

### 1. URL Search Params — `src/routes/explore.tsx`

Add `ts` (time start) and `te` (time end) params in minutes since midnight:

```ts
ts: z.coerce.number().int().min(0).catch(0),     // 0 = no lower bound
te: z.coerce.number().int().min(0).catch(0),      // 0 = no upper bound
```

Defaults: `ts: 0, te: 0` (both 0 means no time filter active). Add to `SEARCH_DEFAULTS`.

### 2. Filter Hook — `src/hooks/use-explore-filters.ts`

Add `timeStart` / `timeEnd` to the filters object and a `setTimeRange(start, end)` setter.

### 3. Filter Component — `src/components/explore/filters/time-range-filter.tsx`

- Use the existing `Slider` component from `src/components/ui/slider.tsx` (supports range via array value).
- **Double-ended slider** with two thumbs for start/end.
- **Range**: `GRID_START_MINUTES` (450 = 7:30 AM) to `GRID_END_MINUTES` (1290 = 9:30 PM).
- **Step**: 30 minutes (configurable via a constant).
- **Labels**: Show formatted time below/above the slider using `formatTime()`.
- Convert slider values (minutes) to URL params, and vice versa.

### 4. Conversion Strategy

The DB stores times in 12hr string format. The conversion is **one-way at read time**:

```
DB string ("10:00 AM") → parseTimeToMinutes() → number (600)
```

Then compare against the filter range `[timeStart, timeEnd]`. No need to convert back — the slider works in minutes, and `parseTimeToMinutes` handles the 12hr input.

### 5. Backend Filtering — `convex/courses.ts`

Two options:

**Option A: Post-filter sections during enrichment** (recommended)
- In `enrichWithSections`, filter out sections whose `classStartTime` falls outside `[timeStart, timeEnd]`.
- This requires passing the time range through to `enrichWithSections`.
- Courses with zero sections after filtering get excluded.
- Pro: No schema change needed. Con: Filtering happens late (after pagination).

**Option B: Denormalized fields on courses**
- Add `sectionEarliestStart: v.optional(v.number())` and `sectionLatestStart: v.optional(v.number())` to courses.
- Populate via `recomputeCourseSectionFilters`.
- Post-filter on these fields in `applyPostFilters`.
- Pro: Filtering before pagination. Con: Schema change + backfill.

**Recommendation**: Start with Option A for simplicity. Can migrate to Option B if performance is an issue.

### 6. `buildConvexFilters` — `src/queries/explore.ts`

Add `timeStart` and `timeEnd` to the filters object when non-zero.

### 7. Filter Tab Integration

Add `<TimeRangeFilter />` to `filters-tab.tsx`. Update `hasFilters` check and `clearFilters` to include time range. Update filter badge count in `filter-panel.tsx`.

## Slider Component Notes

The existing `Slider` component (`src/components/ui/slider.tsx`) is built on `@base-ui/react/slider` and already supports:
- Range values via `value={[start, end]}` (renders two thumbs automatically)
- `step` prop for jump intervals
- `min` / `max` props

## Files to Modify

| File | Change |
|------|--------|
| `src/routes/explore.tsx` | Add `ts`, `te` search params |
| `src/hooks/use-explore-filters.ts` | Add time range state + setter |
| `src/components/explore/filters/time-range-filter.tsx` | **New** — double-ended slider component |
| `src/components/explore/filters/filters-tab.tsx` | Add `TimeRangeFilter` section |
| `src/components/explore/filters/filter-panel.tsx` | Update filter count |
| `src/queries/explore.ts` | Add time range to `buildConvexFilters` |
| `convex/courses.ts` | Add time range args + section-level filtering |
| `src/lib/schedule-time.ts` | (no changes — `parseTimeToMinutes` already handles 12hr) |
