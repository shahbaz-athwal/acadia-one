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

## 3. `addSection` — Pass Color from Client

> Research: [docs/add-section-color.md](docs/add-section-color.md)

- [ ] Add `color` arg to `addSection` mutation in `convex/schedule.ts`
- [ ] Remove server-side color calculation (no more counting existing items)
- [ ] Update client (`course-view-data.tsx`) to pass computed color when calling `addSection`

## 4. Time Range Filter

> Research: [docs/time-range-filter.md](docs/time-range-filter.md)

- [ ] Add `ts` / `te` search params to `explore.tsx` schema
- [ ] Add time range state to `use-explore-filters.ts` hook
- [ ] Create `TimeRangeFilter` component using the double-ended `Slider` (30-min interval jumps, configurable)
- [ ] Handle 12hr → minutes conversion (DB stores 12hr display strings, use `parseTimeToMinutes`)
- [ ] Add time range to `buildConvexFilters` and pass to backend
- [ ] Apply time range filtering in `convex/courses.ts` (section-level filtering during enrichment)
- [ ] Wire into `filters-tab.tsx` and update filter count / clear logic

## 5. Academic Level Filter

> Research: [docs/academic-level-filter.md](docs/academic-level-filter.md)

- [ ] Add `academicLevel` field (`v.optional(v.number())`) to `courses` table in `schema.ts`
- [ ] Add `getAcademicLevel` helper in `convex/internal.ts` (reuses code-splitting regex)
- [ ] Update `upsertCourses` to compute and set `academicLevel` on insert/update
- [ ] Create `backfillAcademicLevel` mutation in `convex/internal.ts`
- [ ] Add `lvl` search param to `explore.tsx` schema
- [ ] Add academic level state to `use-explore-filters.ts` hook
- [ ] Create `AcademicLevelFilter` component (checkbox group)
  - Pre-University: 0
  - First Year: 1
  - Second Year: 2
  - Third Year: 3
  - Fourth Year: 4
  - Graduate 5000-level: 5
  - Graduate 6000-level: 6
  - Graduate 7000-level: 7
  - Post-Baccalaureate 8000-level: 8
  - Transfer Course 9000-level: 9
- [ ] Add `academicLevels` to `buildConvexFilters` and Convex filter args
- [ ] Apply academic level filtering in `convex/courses.ts` (post-filter on `course.academicLevel`)
- [ ] Wire into `filters-tab.tsx` and update filter count / clear logic

## 6. `isLab` Field

> Research: [docs/is-lab-field.md](docs/is-lab-field.md)

- [ ] Add `isLab` field (`v.optional(v.boolean())`) to `courses` table in `schema.ts`
- [ ] Add `isLabCourse` helper in `convex/internal.ts` (code ends with `L` after digits)
- [ ] Update `upsertCourses` to compute and set `isLab` on insert/update
- [ ] Create `backfillIsLab` mutation in `convex/internal.ts`
