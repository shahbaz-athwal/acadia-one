export const TIME_RANGE_MINUTES = 0;
export const TIME_RANGE_MAX_MINUTES = 23 * 60 + 30;
export const TIME_RANGE_STEP_MINUTES = 30;

export const UNDERGRAD_LEVEL_OPTIONS = [
  { value: 0, label: "Pre-University" },
  { value: 1, label: "First Year" },
  { value: 2, label: "Second Year" },
  { value: 3, label: "Third Year" },
  { value: 4, label: "Fourth Year" },
] as const;

export const GRAD_LEVEL_OPTIONS = [
  { value: 5, label: "Graduate 5000-level" },
  { value: 6, label: "Graduate 6000-level" },
  { value: 7, label: "Graduate 7000-level" },
] as const;

export const STANDALONE_LEVEL_OPTIONS = [
  { value: 8, label: "Post-Baccalaureate 8000-level" },
] as const;
