import type { FetchOptions } from "ofetch";
import type { z } from "zod";

export interface AcadiaEndpoint<
  Input,
  ResponseSchema extends z.ZodType = z.ZodType,
> {
  readonly createBody: (input: Input) => FetchOptions<"text">["body"];
  readonly method: "POST";
  readonly operation: string;
  readonly path: `/${string}`;
  readonly responseSchema: ResponseSchema;
}

export function defineAcadiaEndpoint<Input, ResponseSchema extends z.ZodType>(
  endpoint: AcadiaEndpoint<Input, ResponseSchema>
): AcadiaEndpoint<Input, ResponseSchema> {
  return endpoint;
}
