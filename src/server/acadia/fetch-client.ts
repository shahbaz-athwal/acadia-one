import { err, fromThrowable, ok, ResultAsync } from "neverthrow";
import type { Result } from "neverthrow";
import { ofetch } from "ofetch";
import type { FetchResponse } from "ofetch";
import type { z } from "zod";

import type { AcadiaEndpoint } from "./endpoint";
import { acadiaFailure, validationFailure } from "./errors";
import type { AcadiaPortalError, AcadiaResponseDecodeFailure } from "./errors";

export const ACADIA_BASE_URL = "https://collss.acadiau.ca";

export const acadiaAuthFetch = ofetch.create({
  baseURL: new URL("/student/Account/Login", ACADIA_BASE_URL).toString(),
  ignoreResponseError: true,
  redirect: "manual",
  responseType: "text",
  retry: false,
});

type AcadiaTextResponse = FetchResponse<string>;

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
    (cause) =>
      acadiaFailure(operation, {
        ...commonDetails,
        cause,
      } satisfies AcadiaResponseDecodeFailure)
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
    });
  }

  execute<Input, ResponseSchema extends z.ZodType>(
    endpoint: AcadiaEndpoint<Input, ResponseSchema>,
    input: Input
  ): ResultAsync<z.output<ResponseSchema>, AcadiaPortalError> {
    const request = ResultAsync.fromThrowable(
      async () =>
        await this.portalFetch.raw<string, "text">(endpoint.path, {
          body: endpoint.createBody(input),
          method: endpoint.method,
        }),
      (cause) =>
        acadiaFailure(endpoint.operation, {
          cause,
          message: "Unable to reach the Acadia portal.",
          type: "network_failure",
        })
    );

    return request()
      .andThen((response) => {
        if (response.status < 200 || response.status >= 300) {
          return err(
            acadiaFailure(endpoint.operation, {
              message: "Acadia returned a non-success HTTP response.",
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
