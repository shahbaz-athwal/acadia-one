import { expect, test } from "bun:test";

import { z } from "zod";

import { AcadiaClient } from "./fetch-client";
import type { AcadiaEndpoint } from "./fetch-client";

const TestEndpoint = {
  createBody: () => null,
  operation: "test.endpoint",
  path: "/test",
  responseSchema: z.object({ ok: z.boolean() }),
} satisfies AcadiaEndpoint<null, z.ZodObject<{ ok: z.ZodBoolean }>>;

async function executeWithResponse(response: Response) {
  const client = new AcadiaClient("session=test");
  Reflect.set(client, "portalFetch", {
    raw: async () => {
      await Promise.resolve();
      return response;
    },
  });

  const result = await client.execute(TestEndpoint, null);
  if (result.isOk()) {
    throw new Error("Expected the Acadia request to fail.");
  }

  return result.error;
}

test.each([401, 403])(
  "treats HTTP %i as authentication required",
  async (status) => {
    const error = await executeWithResponse(new Response(null, { status }));

    expect(error).toMatchObject({
      message: "Acadia authentication is required.",
      operation: "test.endpoint",
      redirectLocation: null,
      source: "acadia",
      status,
      type: "http_failure",
    });
  }
);

test("treats a login redirect as authentication required", async () => {
  const redirectLocation = "/student/Account/Login?returnUrl=%2Fstudent";
  const error = await executeWithResponse(
    new Response(null, {
      headers: { location: redirectLocation },
      status: 302,
    })
  );

  expect(error).toMatchObject({
    message: "Acadia authentication is required.",
    redirectLocation,
    status: 302,
    type: "http_failure",
  });
});

test("keeps unrelated redirects as generic HTTP failures", async () => {
  const redirectLocation = "/student/maintenance";
  const error = await executeWithResponse(
    new Response(null, {
      headers: { location: redirectLocation },
      status: 302,
    })
  );

  expect(error).toMatchObject({
    message: "Acadia returned a non-success HTTP response.",
    redirectLocation,
    status: 302,
    type: "http_failure",
  });
});
