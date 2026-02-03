/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as departments from "../departments.js";
import type * as internal_ from "../internal.js";
import type * as lib_acadia_auth from "../lib/acadia/auth.js";
import type * as lib_acadia_scraper from "../lib/acadia/scraper.js";
import type * as lib_aiMatcher from "../lib/aiMatcher.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_posthog from "../lib/posthog.js";
import type * as lib_rmp from "../lib/rmp.js";
import type * as professors from "../professors.js";
import type * as terms from "../terms.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  departments: typeof departments;
  internal: typeof internal_;
  "lib/acadia/auth": typeof lib_acadia_auth;
  "lib/acadia/scraper": typeof lib_acadia_scraper;
  "lib/aiMatcher": typeof lib_aiMatcher;
  "lib/constants": typeof lib_constants;
  "lib/posthog": typeof lib_posthog;
  "lib/rmp": typeof lib_rmp;
  professors: typeof professors;
  terms: typeof terms;
  workflows: typeof workflows;
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
