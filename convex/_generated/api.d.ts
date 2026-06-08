/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as automations from "../automations.js";
import type * as folders from "../folders.js";
import type * as http from "../http.js";
import type * as notes from "../notes.js";
import type * as notesActions from "../notesActions.js";
import type * as users from "../users.js";
import type * as webSearch from "../webSearch.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  automations: typeof automations;
  folders: typeof folders;
  http: typeof http;
  notes: typeof notes;
  notesActions: typeof notesActions;
  users: typeof users;
  webSearch: typeof webSearch;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
