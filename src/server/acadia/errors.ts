import type { z } from "zod";

export interface AcadiaErrorContext {
  readonly operation: string;
  readonly source: "acadia";
}

export interface AcadiaNetworkFailure {
  readonly cause: unknown;
  readonly message: string;
  readonly type: "network_failure";
}

export interface AcadiaHttpFailure {
  readonly message: string;
  readonly status: number;
  readonly type: "http_failure";
}

export interface AcadiaResponseDecodeFailure {
  readonly bodyKind: "empty" | "html" | "text";
  readonly bodyLength: number;
  readonly cause?: unknown;
  readonly contentType: string | null;
  readonly message: string;
  readonly status: number;
  readonly type: "response_decode_failure";
}

export interface AcadiaValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: readonly PropertyKey[];
}

export interface AcadiaResponseValidationFailure {
  readonly issues: readonly AcadiaValidationIssue[];
  readonly message: string;
  readonly omittedIssueCount: number;
  readonly type: "response_validation_failure";
}

export interface AcadiaIncorrectCredentialFailure {
  readonly message: string;
  readonly type: "incorrect_credential";
}

export interface AcadiaUnexpectedAuthResponseDetails {
  readonly redirectLocation?: string | null;
  readonly status?: number;
  readonly title?: string | null;
}

export interface AcadiaUnexpectedAuthResponseFailure {
  readonly details?: AcadiaUnexpectedAuthResponseDetails;
  readonly message: string;
  readonly type: "unexpected_auth_response";
}

export type AcadiaFailureDetail =
  | AcadiaNetworkFailure
  | AcadiaHttpFailure
  | AcadiaResponseDecodeFailure
  | AcadiaResponseValidationFailure
  | AcadiaIncorrectCredentialFailure
  | AcadiaUnexpectedAuthResponseFailure;

export type AcadiaFailure<
  Detail extends AcadiaFailureDetail = AcadiaFailureDetail,
> = AcadiaErrorContext & Detail;

export type AcadiaPortalError = AcadiaFailure<
  | AcadiaNetworkFailure
  | AcadiaHttpFailure
  | AcadiaResponseDecodeFailure
  | AcadiaResponseValidationFailure
>;

export type AcadiaAuthError = AcadiaFailure<
  | AcadiaNetworkFailure
  | AcadiaIncorrectCredentialFailure
  | AcadiaUnexpectedAuthResponseFailure
>;

export function acadiaFailure<Detail extends AcadiaFailureDetail>(
  operation: string,
  detail: Detail
): AcadiaFailure<Detail> {
  return {
    ...detail,
    operation,
    source: "acadia",
  };
}

const MAX_VALIDATION_ISSUES = 20;

export function validationFailure(
  operation: string,
  issues: readonly z.core.$ZodIssue[]
): AcadiaFailure<AcadiaResponseValidationFailure> {
  return acadiaFailure(operation, {
    issues: issues.slice(0, MAX_VALIDATION_ISSUES).map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path,
    })),
    message: "Acadia returned an unexpected response shape.",
    omittedIssueCount: Math.max(issues.length - MAX_VALIDATION_ISSUES, 0),
    type: "response_validation_failure",
  });
}
