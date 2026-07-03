import { expect, setDefaultTimeout, test } from "bun:test";

import { authenticateAcadiaStudent } from "./auth";

setDefaultTimeout(30_000);

test("authenticates with admin credentials and returns at least six cookies", async () => {
  const result = await authenticateAcadiaStudent(
    process.env.ACADIA_ADMIN_USERNAME,
    process.env.ACADIA_ADMIN_PASSWORD
  );

  if (result.isErr()) {
    throw new Error(
      `Expected Acadia authentication to succeed: ${result.error.type}`
    );
  }

  const cookies = result.value;
  const cookieCount = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.length > 0).length;

  expect(cookieCount).toBeGreaterThanOrEqual(6);
});
