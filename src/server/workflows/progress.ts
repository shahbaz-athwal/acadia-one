/**
 * What a long-running import reports while it is still running. Shared so the
 * admin dashboard has one shape to render regardless of which import is active;
 * `unit` is what the workflow happens to be counting.
 */
export interface ImportProgress {
  readonly completed: number;
  readonly total: number;
  /** Plural noun, rendered straight into the UI: `12 / 244 professors`. */
  readonly unit: string;
}
