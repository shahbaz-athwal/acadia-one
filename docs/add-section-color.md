# `addSection` — Pass Color from Client

## Current State

Color is calculated **on the server** inside `convex/schedule.ts` `addSection` mutation:

```ts
// convex/schedule.ts lines 33–40
const existingItems = await ctx.db
  .query("scheduleItems")
  .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
  .collect();

const color = SCHEDULE_COLORS[existingItems.length % SCHEDULE_COLORS.length];
```

The same formula is **duplicated** on the client in two places:

1. **Optimistic update** (`src/components/explore/courses/course-view-data.tsx` line 57):
   ```ts
   const color = SCHEDULE_COLORS[current.length % SCHEDULE_COLORS.length];
   ```

2. **Hover preview** (same file, lines 150–153):
   ```ts
   SCHEDULE_COLORS[allItems.length % SCHEDULE_COLORS.length] ?? "#94a3b8"
   ```

The mutation args currently only accept `{ sessionId, sectionId }` and return `{ id, color }`.

## Proposed Changes

### 1. `convex/schedule.ts` — Add `color` arg, remove server calc

```
Before args: { sessionId: v.string(), sectionId: v.id("sections") }
After args:  { sessionId: v.string(), sectionId: v.id("sections"), color: v.string() }
```

- Remove the query for `existingItems` (lines 33–37) and the `SCHEDULE_COLORS` computation (lines 39–40).
- Use `args.color` directly when inserting the `scheduleItems` doc.
- Remove the `SCHEDULE_COLORS` import.
- Return type stays `{ id, color }` (now just echoes back `args.color`).

### 2. `src/components/explore/courses/course-view-data.tsx` — Pass color in mutation call

The client already computes color for the optimistic update. Pass the same value to the mutation:

```
Before: addSection({ sessionId, sectionId: s._id })
After:  addSection({ sessionId, sectionId: s._id, color })
```

Where `color` is computed from `allItems.length` (same formula already used for preview).

The optimistic update already uses the correct color — no change needed there.

## Files to Modify

| File | Change |
|------|--------|
| `convex/schedule.ts` | Add `color` arg, remove server color calc, remove `SCHEDULE_COLORS` import |
| `src/components/explore/courses/course-view-data.tsx` | Compute color before mutation call, pass it as arg |
