# Task Checklist

## 1. Auth Flow — Never-Throw Safe Try

> Research: [docs/auth-safe-try.md](docs/auth-safe-try.md)

- [ ] Convert `authenticateWithAxios` (`convex/acadia/auth.ts`) to return `Result` type instead of throwing
- [ ] Convert `encryptCredentials` (`convex/lib/encryption.ts`) to return `Result` type
- [ ] Convert `decryptCredentials` (`convex/lib/encryption.ts`) to return `Result` type
- [ ] Update `convex/auth.ts` to use result-based branching instead of try/catch
- [ ] Update `convex/acadia/impersonator.ts` to unwrap `Result` from decrypt/auth calls

## 2. Schedule Preview — Remove Breathing Effect & Dim Background

> Research: [docs/schedule-preview.md](docs/schedule-preview.md)

- [ ] Remove `animate-pulse` from `PreviewBlock` in `schedule-calendar.tsx`
- [ ] Remove per-block `dimmed` prop from `ScheduleBlock`
- [ ] Add a full-background dim overlay (`bg-background/60`) when previewing instead of individually dimming sections
- [ ] Ensure preview block z-index sits above the overlay

## 6. `isLab` Field

> Research: [docs/is-lab-field.md](docs/is-lab-field.md)

- [ ] Add `isLab` field (`v.optional(v.boolean())`) to `courses` table in `schema.ts`
- [ ] Add `isLabCourse` helper in `convex/internal.ts` (code ends with `L` after digits)
- [ ] Update `upsertCourses` to compute and set `isLab` on insert/update
- [ ] Create `backfillIsLab` mutation in `convex/internal.ts`
