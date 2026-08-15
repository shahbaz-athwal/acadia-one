import { err, fromThrowable, ok, ResultAsync } from "neverthrow";
import type { Result } from "neverthrow";
import { ofetch } from "ofetch";
import type { FetchOptions, FetchResponse } from "ofetch";
import type { z } from "zod";

import { acadiaFailure, validationFailure } from "./errors";
import type { AcadiaPortalError } from "./errors";

export const ACADIA_BASE_URL = "https://collss.acadiau.ca";
export const ACADIA_REQUEST_TIMEOUT_MS = 15_000;

export const acadiaAuthFetch = ofetch.create({
  baseURL: new URL("/student/Account/Login", ACADIA_BASE_URL).toString(),
  ignoreResponseError: true,
  redirect: "manual",
  responseType: "text",
  retry: false,
  timeout: ACADIA_REQUEST_TIMEOUT_MS,
});

type AcadiaTextResponse = FetchResponse<string>;

export interface AcadiaEndpoint<
  Input,
  ResponseSchema extends z.ZodType = z.ZodType,
> {
  readonly createBody: (input: Input) => FetchOptions<"text">["body"];
  readonly operation: string;
  readonly path: `/${string}`;
  readonly responseSchema: ResponseSchema;
}

function getBodyKind(body: string | undefined) {
  if (body === undefined || body.trim().length === 0) {
    return "empty" as const;
  }

  if (/^\s*(?:<!doctype\s+html|<html\b)/iu.test(body)) {
    return "html" as const;
  }

  return "text" as const;
}

function decodeJsonResponse(
  operation: string,
  response: AcadiaTextResponse
): Result<unknown, AcadiaPortalError> {
  const body = response._data;
  const commonDetails = {
    bodyKind: getBodyKind(body),
    bodyLength: body?.length ?? 0,
    contentType: response.headers.get("content-type"),
    message: "Acadia returned a response that could not be decoded as JSON.",
    status: response.status,
    type: "response_decode_failure" as const,
  };

  if (body === undefined || body.trim().length === 0) {
    return err(acadiaFailure(operation, commonDetails));
  }

  return fromThrowable(
    (): unknown => JSON.parse(body),
    () => acadiaFailure(operation, commonDetails)
  )();
}

function validateResponse<ResponseSchema extends z.ZodType>(
  operation: string,
  schema: ResponseSchema,
  body: unknown
): Result<z.output<ResponseSchema>, AcadiaPortalError> {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return err(validationFailure(operation, parsed.error.issues));
  }

  return ok(parsed.data);
}

export class AcadiaClient {
  private readonly portalFetch: ReturnType<typeof ofetch.create>;

  constructor(cookies: string) {
    this.portalFetch = ofetch.create({
      baseURL: ACADIA_BASE_URL,
      ignoreResponseError: true,
      onRequest({ options }) {
        options.headers.set("Accept", "application/json");
        options.headers.set("Cookie", cookies);
      },
      redirect: "manual",
      responseType: "text",
      retry: false,
      timeout: ACADIA_REQUEST_TIMEOUT_MS,
    });
  }

  execute<Input, ResponseSchema extends z.ZodType>(
    endpoint: AcadiaEndpoint<Input, ResponseSchema>,
    input: Input
  ): ResultAsync<z.output<ResponseSchema>, AcadiaPortalError> {
    return ResultAsync.fromPromise(
      this.portalFetch.raw<string, "text">(endpoint.path, {
        body: endpoint.createBody(input),
        method: "POST",
      }),
      () =>
        acadiaFailure(endpoint.operation, {
          message: "Unable to reach the Acadia portal.",
          type: "network_failure",
        })
    )
      .andThen((response) => {
        if (response.status < 200 || response.status >= 300) {
          const redirectLocation = response.headers.get("location");
          const authenticationRequired =
            response.status === 401 ||
            response.status === 403 ||
            redirectLocation
              ?.toLowerCase()
              .includes("/student/account/login") === true;

          return err(
            acadiaFailure(endpoint.operation, {
              message: authenticationRequired
                ? "Acadia authentication is required."
                : "Acadia returned a non-success HTTP response.",
              redirectLocation,
              status: response.status,
              type: "http_failure",
            })
          );
        }

        return decodeJsonResponse(endpoint.operation, response);
      })
      .andThen((body) =>
        validateResponse(endpoint.operation, endpoint.responseSchema, body)
      );
  }
}
