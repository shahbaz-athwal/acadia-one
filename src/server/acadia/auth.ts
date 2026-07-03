import { err, ok, ResultAsync } from "neverthrow";
import type { Result } from "neverthrow";
import type { FetchResponse } from "ofetch";

import { acadiaAuthFetch } from "./fetch-client";

const ACADIA_SELF_SERVICE_TITLE = "Acadia University Self-Service";
const ACADIA_SIGN_IN_TITLE = "Sign In - Acadia University Self-Service";

interface AcadiaAuthErrorDetails {
  readonly redirectLocation?: string | null;
  readonly status?: number;
  readonly title?: string | null;
}

export type AcadiaAuthError =
  | {
      readonly cause: unknown;
      readonly message: string;
      readonly type: "network_failure";
    }
  | {
      readonly message: string;
      readonly type: "incorrect_credential";
    }
  | {
      readonly details?: AcadiaAuthErrorDetails;
      readonly message: string;
      readonly type: "unknown_error";
    };

type AcadiaHtmlResponse = FetchResponse<string>;

interface LoginContext {
  readonly cookies: string[];
  readonly loginUrl: string;
  readonly redirectLocation: string;
}

interface RedirectContext {
  readonly cookies: string[];
  readonly response: AcadiaHtmlResponse;
}

function extractCookieValues(headers: Headers) {
  return (
    (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
    []
  )
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(
      (cookie): cookie is string => cookie !== undefined && cookie.length > 0
    );
}

function extractHtmlTitle(html: string | undefined) {
  const title = html?.match(/<title(?:\s[^>]*)?>(?<title>[\s\S]*?)<\/title>/iu)
    ?.groups?.title;

  return title?.replaceAll(/\s+/gu, " ").trim() ?? null;
}

function toNetworkFailure(cause: unknown): AcadiaAuthError {
  return {
    cause,
    message: "Unable to reach Acadia authentication.",
    type: "network_failure",
  };
}

function unknownError(
  message: string,
  details?: AcadiaAuthErrorDetails
): AcadiaAuthError {
  return {
    details,
    message,
    type: "unknown_error",
  };
}

function submitCredentials(
  username: string,
  password: string
): ResultAsync<AcadiaHtmlResponse, AcadiaAuthError> {
  const formData = new URLSearchParams({
    Password: password,
    UserName: username,
  });

  return ResultAsync.fromPromise(
    acadiaAuthFetch.raw<string, "text">("", {
      body: formData.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    }),
    toNetworkFailure
  );
}

function inspectLoginResponse(
  loginResponse: AcadiaHtmlResponse
): Result<LoginContext, AcadiaAuthError> {
  const cookies = extractCookieValues(loginResponse.headers);
  const redirectLocation = loginResponse.headers.get("location");
  const title = extractHtmlTitle(loginResponse._data);

  if (title === ACADIA_SIGN_IN_TITLE) {
    return err({
      message: "The Acadia credentials were rejected.",
      type: "incorrect_credential",
    });
  }

  if (
    loginResponse.status !== 302 ||
    redirectLocation === null ||
    redirectLocation.length === 0
  ) {
    return err(
      unknownError("Acadia authentication did not return a redirect.", {
        redirectLocation,
        status: loginResponse.status,
        title,
      })
    );
  }

  return ok({
    cookies,
    loginUrl: loginResponse.url,
    redirectLocation,
  });
}

function fetchRedirect(
  context: LoginContext
): ResultAsync<RedirectContext, AcadiaAuthError> {
  return ResultAsync.fromPromise(
    acadiaAuthFetch.raw<string, "text">(
      new URL(context.redirectLocation, context.loginUrl).toString(),
      {
        headers: {
          Cookie: context.cookies.join("; "),
        },
        method: "GET",
      }
    ),
    toNetworkFailure
  ).map((response) => ({
    cookies: context.cookies,
    response,
  }));
}

function inspectSelfServiceResponse(
  context: RedirectContext
): Result<string, AcadiaAuthError> {
  const title = extractHtmlTitle(context.response._data);

  if (title !== ACADIA_SELF_SERVICE_TITLE) {
    return err(
      unknownError("Acadia authentication did not reach self-service.", {
        status: context.response.status,
        title,
      })
    );
  }

  const redirectCookies = extractCookieValues(context.response.headers);

  return ok([...context.cookies, ...redirectCookies].join("; "));
}

export function authenticateAcadiaStudent(
  username: string,
  password: string
): ResultAsync<string, AcadiaAuthError> {
  return submitCredentials(username, password)
    .andThen(inspectLoginResponse)
    .andThen(fetchRedirect)
    .andThen(inspectSelfServiceResponse);
}
