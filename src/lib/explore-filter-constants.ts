export const TIME_RANGE_MINUTES = 7 * 60 + 30;
export const TIME_RANGE_MAX_MINUTES = 21 * 60;
export const TIME_RANGE_STEP_MINUTES = 30;

export const UNDERGRAD_LEVEL_OPTIONS = [
  { value: 0, label: "Pre-University" },
  { value: 1, label: "First Year 1000" },
  { value: 2, label: "Second Year 2000" },
  { value: 3, label: "Third Year 3000" },
  { value: 4, label: "Fourth Year 4000" },
] as const;

export const GRAD_LEVEL_OPTIONS = [
  { value: 5, label: "First Master's 5000" },
  { value: 6, label: "Second Master's 6000" },
  { value: 7, label: "Third Master's 7000" },
] as const;

export const STANDALONE_LEVEL_OPTIONS = [
  { value: 8, label: "Post-Baccalaureate 8000" },
] as const;
