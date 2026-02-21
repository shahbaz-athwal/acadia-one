# Schedule Preview — Remove Breathing Effect & Dim Background

## Current State

### Breathing / Pulse Animation

Located in `src/components/explore/schedule/schedule-calendar.tsx`, line 188:

```tsx
className="absolute inset-x-0.5 animate-pulse overflow-hidden rounded-md border border-dashed px-1.5 py-1 text-xs leading-tight"
```

The `PreviewBlock` component (ghost block shown on hover) uses Tailwind's `animate-pulse` class, creating a breathing/fading effect on the preview.

### Per-Block Dimming

When a preview is active (`isPreviewing = previewSection !== null`), **every existing schedule block** is individually dimmed:

**`schedule-calendar.tsx`** line 153–154:
```tsx
<ScheduleBlock dimmed={isPreviewing} item={item} key={item.scheduleItemId} />
```

**`schedule-block.tsx`** lines 21–24:
```tsx
className={cn(
  "absolute inset-x-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-xs leading-tight transition-opacity",
  dimmed && "opacity-20",
  className
)}
```

Each block receives `dimmed={true}` and applies `opacity-20` individually.

## Proposed Changes

### 1. Remove `animate-pulse` from `PreviewBlock`

In `schedule-calendar.tsx`, remove `animate-pulse` from the className on line 188. The preview block should remain static — the dashed border and translucent fill already distinguish it from real blocks.

### 2. Replace per-block dimming with a full background overlay

Instead of passing `dimmed` to every `ScheduleBlock` and applying `opacity-20` individually:

- **Remove** the `dimmed` prop from `ScheduleBlock` (both the interface and the className conditional).
- **Remove** `dimmed={isPreviewing}` from the `<ScheduleBlock>` usage in `schedule-calendar.tsx`.
- **Add** a semi-transparent overlay `<div>` inside each day column's body (`<div className="relative">`) that covers the full grid when `isPreviewing` is true.

Approach: Add an overlay div right before the preview block in the day column body:

```tsx
{isPreviewing && (
  <div className="absolute inset-0 z-[1] bg-background/60" />
)}
```

This dims the entire day column uniformly (grid lines + all blocks) rather than dimming each block individually. The preview block itself should sit above the overlay (z-index).

### 3. Ensure preview block sits above overlay

Give the `PreviewBlock` a z-index higher than the overlay (e.g. `z-[2]`).

## Files to Modify

| File | Change |
|------|--------|
| `src/components/explore/schedule/schedule-calendar.tsx` | Remove `animate-pulse`, remove `dimmed={isPreviewing}`, add overlay div |
| `src/components/explore/schedule/schedule-block.tsx` | Remove `dimmed` prop and `opacity-20` conditional |
