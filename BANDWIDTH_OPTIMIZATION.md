# Convex Database Bandwidth Optimization

## Problem

Convex usage dashboard shows database bandwidth limit reached. Analysis of function call volume and data access patterns reveals several high-bandwidth culprits, primarily in workflow mutations and the main explore query.

## Function Call Volume (from dashboard)

| Function | Calls | Category |
|---|---|---|
| `internal.recomputeCourseAggregates` | 5.6K | Workflow |
| `internal.recomputeCourseSectionFilters` | 2.8K | Workflow |
| `courses.listForExplore` | 1.6K | Client query |
| `internal.getProfessorByExternalId` | 1.5K | Workflow |
| `internal.upsertCourseProfessors` | 1.4K | Workflow |
| `internal.upsertTerms` | 1.4K | Workflow |
| `internal.upsertProfessors` | 1.3K | Workflow |
| `workflow/processCourse.processCourse` | 1.3K | Workflow |
| `internal.upsertSections` | 1.3K | Workflow |
| `internal.recomputeProfessorAggregates` | 834 | Workflow |

---

## Culprit #1: `courses.listForExplore` — Full table scan per page view

**File:** [`convex/courses.ts`](convex/courses.ts) (line 96)

**Estimated bandwidth:** ~2–4 GB total (1.6K calls × ~1.3–2.6 MB per call)

Every call collects the **entire courses table** into memory, filters in JavaScript, then slices a 10-item page:

```ts
const allCourses = await coursesQuery.collect(); // reads ALL courses
const allMatching = hasSectionFilters
  ? allCourses.filter(...)
  : allCourses;
const pageCourses = allMatching.slice(start, start + args.pageSize);
```

The `.filter()` on `departmentPrefix` (line 85–93) uses a post-scan filter on the `by_code` index — Convex reads every document and discards non-matches. The `by_departmentPrefix` index exists but is unused here.

### Fixes

1. **Switch to Convex `.paginate()`** instead of manual offset pagination. This avoids reading the entire table on every call.
2. **Use `withIndex("by_departmentPrefix")` for single-department filters** instead of `.filter()`. For multi-department, run parallel queries per prefix and merge.
3. **If total count is needed**, store it as a denormalized counter on a separate document rather than reading every row to count.

---

## Culprit #2: `recomputeCourseAggregates` — 5.6K full index scans

**File:** [`convex/internal.ts`](convex/internal.ts) (line 574–606)

**Estimated bandwidth:** ~56–140 MB total

Called from two workflows:
- [`convex/workflow/syncAggregates.ts`](convex/workflow/syncAggregates.ts) — loops through ALL courses, calling this once per course (~1,300 per run)
- [`convex/workflow/pullReviews.ts`](convex/workflow/pullReviews.ts) (line 152–155) — calls it for every course a professor has ratings for

Each call collects **all ratings** for one course just to compute a count and two averages:

```ts
const ratings = await ctx.db
  .query("ratings")
  .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
  .collect();
```

### Fixes

1. **Incremental aggregation:** When `insertRatings` adds new ratings, update the aggregate inline — increment `ratingCount`, adjust running averages — instead of re-reading all ratings from scratch.
2. **Deduplicate in `pullRmpReviews`:** Multiple professors may share courses. Collect unique course IDs and recompute each only once.
3. **Gate `syncAggregateDocuments`:** Only recompute for courses that actually changed since the last sync, or eliminate the workflow entirely if incremental updates keep aggregates fresh.

---

## Culprit #3: `recomputeCourseSectionFilters` — 2.8K full index scans

**File:** [`convex/internal.ts`](convex/internal.ts) (line 608–636)

**Estimated bandwidth:** ~30–80 MB total

Called from:
- [`convex/workflow/syncAggregates.ts`](convex/workflow/syncAggregates.ts) — once per course (~1,300 per run)
- [`convex/workflow/processCourse.ts`](convex/workflow/processCourse.ts) (line 154) — once per course processed (1.3K calls)

Each call re-reads all sections for a course:

```ts
const sections = await ctx.db
  .query("sections")
  .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
  .collect();
```

### Fixes

1. **Compute inline in `processCourse`:** The `processCourseInternal` function (line 121–149 of `processCourse.ts`) already has the full sections payload in memory. Compute `sectionTermCodes`, `sectionProfessorIds`, and `sectionDays` directly and pass them to a lightweight patch mutation, avoiding a redundant re-read.
2. **Remove from `syncAggregateDocuments`** if `processCourse` already keeps these fields in sync.

---

## Culprit #4: `syncAggregateDocuments` — The amplifier

**File:** [`convex/workflow/syncAggregates.ts`](convex/workflow/syncAggregates.ts)

A single invocation generates `2 × num_courses + num_professors` mutations (~2,850 with current data), each with its own full index scan:

```ts
for (const courseId of courseIds) {
  await ctx.runMutation(internal.internal.recomputeCourseAggregates, { courseId });
  await ctx.runMutation(internal.internal.recomputeCourseSectionFilters, { courseId });
}
for (const professorId of professorIds) {
  await ctx.runMutation(internal.internal.recomputeProfessorAggregates, { professorId });
}
```

It also starts with two full table scans to get all IDs:
- [`convex/internal.ts`](convex/internal.ts) line 793 — `listAllCourseIds` collects all courses
- [`convex/internal.ts`](convex/internal.ts) line 840 — `listAllProfessorIds` collects all professors

### Fixes

1. **Eliminate as a regular workflow.** If aggregates are updated incrementally in `processCourse` and `pullRmpReviews`, this becomes unnecessary.
2. **Keep only as a rare repair tool.** If needed, add a `lastAggregateComputedAt` field and only recompute stale entities.

---

## Culprit #5: `processCourse` cascade — 1.3K calls × 7+ DB operations each

**File:** [`convex/workflow/processCourse.ts`](convex/workflow/processCourse.ts)

Each call triggers a chain of mutations:

1. `upsertTerms` — 1 mutation
2. `upsertProfessors` — 1 mutation
3. `getProfessorByExternalId` — N queries (one per instructor)
4. `upsertCourseProfessors` — 1 mutation
5. `upsertSections` — 1 mutation
6. `recomputeCourseSectionFilters` — 1 mutation (re-reads sections)
7. `updateCourseLastSectionPulledAt` — 1 mutation

Triggered by `triggerCourseProcessing` which schedules ALL courses at once, staggered by 500ms.

### Fixes

1. **Compute section filters inline** (see Culprit #3 above).
2. **Batch professor lookups** — pass all instructor external IDs in a single query instead of one per instructor.
3. **Skip fresh courses** — add a staleness check (`lastSectionPulledAt` threshold) in `triggerCourseProcessing` and skip recently processed courses.

---

## Prioritized Action Plan

| Priority | Fix | Est. Savings | Files |
|---|---|---|---|
| **P0** | Switch `listForExplore` to `.paginate()` + `by_departmentPrefix` index | ~2–4 GB | `convex/courses.ts` |
| **P0** | Make `recomputeCourseAggregates` incremental (update inline in `insertRatings`) | ~100 MB + eliminates 5.6K calls | `convex/internal.ts`, `convex/workflow/pullReviews.ts` |
| **P1** | Eliminate or gate `syncAggregateDocuments` to only changed entities | ~2,850 mutations per run | `convex/workflow/syncAggregates.ts` |
| **P1** | Compute section filters inline in `processCourse` instead of re-reading | ~30–80 MB | `convex/workflow/processCourse.ts`, `convex/internal.ts` |
| **P2** | Add staleness check to `triggerCourseProcessing` | Reduces 1.3K calls | `convex/workflow/processCourse.ts` |
| **P2** | Batch professor lookups in `processCourse` | Minor per-call savings | `convex/workflow/processCourse.ts` |
