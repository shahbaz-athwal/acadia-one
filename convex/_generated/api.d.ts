/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as acadia_auth from "../acadia/auth.js";
import type * as acadia_impersonator from "../acadia/impersonator.js";
import type * as acadia_programs from "../acadia/programs.js";
import type * as acadia_schemas_postSearchCriteria from "../acadia/schemas/postSearchCriteria.js";
import type * as acadia_schemas_programEvaluation from "../acadia/schemas/programEvaluation.js";
import type * as acadia_schemas_section from "../acadia/schemas/section.js";
import type * as acadia_schemas_studentGrades from "../acadia/schemas/studentGrades.js";
import type * as acadia_schemas_studentProgram from "../acadia/schemas/studentProgram.js";
import type * as acadia_scraper from "../acadia/scraper.js";
import type * as addToSchedule from "../addToSchedule.js";
import type * as auth from "../auth.js";
import type * as courses from "../courses.js";
import type * as departments from "../departments.js";
import type * as explore from "../explore.js";
import type * as internal_ from "../internal.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_posthog from "../lib/posthog.js";
import type * as lib_rmp from "../lib/rmp.js";
import type * as professors from "../professors.js";
import type * as sessions from "../sessions.js";
import type * as terms from "../terms.js";
import type * as workflow_populate from "../workflow/populate.js";
import type * as workflow_processCourse from "../workflow/processCourse.js";
import type * as workflow_pullReviews from "../workflow/pullReviews.js";
import type * as workflow_rmpLink from "../workflow/rmpLink.js";
import type * as workflow_syncAggregates from "../workflow/syncAggregates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "acadia/auth": typeof acadia_auth;
  "acadia/impersonator": typeof acadia_impersonator;
  "acadia/programs": typeof acadia_programs;
  "acadia/schemas/postSearchCriteria": typeof acadia_schemas_postSearchCriteria;
  "acadia/schemas/programEvaluation": typeof acadia_schemas_programEvaluation;
  "acadia/schemas/section": typeof acadia_schemas_section;
  "acadia/schemas/studentGrades": typeof acadia_schemas_studentGrades;
  "acadia/schemas/studentProgram": typeof acadia_schemas_studentProgram;
  "acadia/scraper": typeof acadia_scraper;
  addToSchedule: typeof addToSchedule;
  auth: typeof auth;
  courses: typeof courses;
  departments: typeof departments;
  explore: typeof explore;
  internal: typeof internal_;
  "lib/constants": typeof lib_constants;
  "lib/encryption": typeof lib_encryption;
  "lib/posthog": typeof lib_posthog;
  "lib/rmp": typeof lib_rmp;
  professors: typeof professors;
  sessions: typeof sessions;
  terms: typeof terms;
  "workflow/populate": typeof workflow_populate;
  "workflow/processCourse": typeof workflow_processCourse;
  "workflow/pullReviews": typeof workflow_pullReviews;
  "workflow/rmpLink": typeof workflow_rmpLink;
  "workflow/syncAggregates": typeof workflow_syncAggregates;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
