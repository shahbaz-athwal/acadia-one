# `isLab` Field

## Current State

### Course Code Format

Course codes like `COMP3456` have an optional trailing letter. From the requisites regex in `convex/acadia/schemas/postSearchCriteria.ts`:

```ts
/\b([A-Z]{2,6})\s*(?:-\s*|\s+)?([0-9]{3,4}[A-Z]?)\b/gi
```

The `[A-Z]?` at the end indicates some course numbers have a trailing letter (e.g. `COMP3456L`). When that letter is `L`, the course is a lab section.

### Detection Logic

```ts
function isLabCourse(code: string): boolean {
  return /\d+L$/i.test(code);
}
```

Matches codes where the numeric part ends with `L`:
- `COMP3456L` → true
- `COMP3456` → false
- `BIOL2033L` → true

### Course Creation Path

Courses are created/updated exclusively through:
- `convex/workflow/populate.ts` → `populateCourses` → calls `internal.upsertCourses`
- `convex/internal.ts` → `upsertCourses` — the central upsert mutation

## Proposed Changes

### 1. Schema — `convex/schema.ts`

Add `isLab` field to the `courses` table:

```ts
isLab: v.optional(v.boolean()),  // true if course code ends with "L"
```

Use `v.optional()` for backward compatibility.

### 2. Lab Detection Helper — `convex/internal.ts`

```ts
function isLabCourse(code: string): boolean {
  return /\d+L$/i.test(code);
}
```

### 3. Update `upsertCourses` — `convex/internal.ts`

Compute `isLab` from `course.code` in both insert and patch paths:

```ts
const isLab = isLabCourse(course.code);
```

### 4. Backfill Mutation — `convex/internal.ts`

```ts
export const backfillIsLab = internalMutation({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    for (const course of courses) {
      await ctx.db.patch(course._id, {
        isLab: isLabCourse(course.code),
      });
    }
    return courses.length;
  },
});
```

### 5. Workflow — No changes needed

`populate.ts` calls `upsertCourses` which will now set `isLab` automatically. `processCourse.ts` doesn't touch course creation fields.

## Files to Modify

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `isLab` field to courses |
| `convex/internal.ts` | Add `isLabCourse` helper, update `upsertCourses`, add `backfillIsLab` |
