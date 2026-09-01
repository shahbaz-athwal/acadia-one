import { err, ok, ResultAsync } from "neverthrow";
import type { Result } from "neverthrow";
import { ofetch } from "ofetch";
import type { z } from "zod";

export const RMP_GRAPHQL_URL = "https://www.ratemyprofessors.com/graphql";
export const RMP_REQUEST_TIMEOUT_MS = 20_000;

/**
 * Acadia University. RMP node ids are base64 of `School-<n>`, so this decodes
 * to `School-1406`.
 */
export const RMP_ACADIA_SCHOOL_ID = "U2Nob29sLTE0MDY=";

export interface RmpError {
  readonly issues?: readonly string[];
  readonly message: string;
  readonly operation: string;
  readonly source: "rmp";
  readonly type:
    | "graphql_failure"
    | "network_failure"
    | "response_validation_failure";
}

function rmpFailure(
  operation: string,
  type: RmpError["type"],
  message: string,
  issues?: readonly string[]
): RmpError {
  return { issues, message, operation, source: "rmp", type };
}

/**
 * RMP 403s anything whose `User-Agent` does not look like a browser — a bare
 * `Python-urllib` is refused outright. ofetch's default happens to get through,
 * but that is not something to leave to chance, so it is pinned here.
 */
const RMP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * RMP's public GraphQL endpoint gates on a fixed basic credential (`test:test`)
 * rather than a per-caller key. There is nothing to configure.
 */
const rmpFetch = ofetch.create({
  headers: {
    Authorization: "Basic dGVzdDp0ZXN0",
    "Content-Type": "application/json",
    "User-Agent": RMP_USER_AGENT,
  },
  retry: 2,
  retryDelay: 500,
  timeout: RMP_REQUEST_TIMEOUT_MS,
});

interface GraphQLEnvelope {
  data?: unknown;
  errors?: { message?: string }[];
}

/**
 * GraphQL reports failures in the body with a 200 status, so a successful fetch
 * still has to be inspected before the payload is worth validating.
 */
export function executeRmpQuery<Schema extends z.ZodType>(
  operation: string,
  query: string,
  variables: Record<string, unknown>,
  schema: Schema
): ResultAsync<z.output<Schema>, RmpError> {
  return ResultAsync.fromPromise(
    rmpFetch<GraphQLEnvelope>(RMP_GRAPHQL_URL, {
      body: { query, variables },
      method: "POST",
    }),
    (cause) =>
      rmpFailure(
        operation,
        "network_failure",
        `Unable to reach Rate My Professors: ${
          cause instanceof Error ? cause.message : String(cause)
        }`
      )
  ).andThen((envelope): Result<z.output<Schema>, RmpError> => {
    if (envelope.errors !== undefined && envelope.errors.length > 0) {
      return err(
        rmpFailure(
          operation,
          "graphql_failure",
          "Rate My Professors returned GraphQL errors.",
          envelope.errors.map((issue) => issue.message ?? "unknown error")
        )
      );
    }

    const parsed = schema.safeParse(envelope.data);

    if (!parsed.success) {
      return err(
        rmpFailure(
          operation,
          "response_validation_failure",
          "Rate My Professors returned an unexpected response shape.",
          parsed.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`
          )
        )
      );
    }

    return ok(parsed.data);
  });
}
