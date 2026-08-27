import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getDatabase } from "@/db";
import { adminMiddleware } from "@/server/admin/middleware";
import {
  createAdminTerm,
  listAdminTerms,
  previewTermArchive,
  setTermsArchived,
} from "@/server/admin/terms";

const TERM_CODE_PATTERN = /^[A-Za-z0-9-]{2,32}$/u;

const termCodesSchema = z.object({
  termCodes: z.array(z.string().min(1)).min(1).max(200),
});

export const listTerms = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => await listAdminTerms(getDatabase()));

export const previewArchiveTerms = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(termCodesSchema)
  .handler(
    async ({ data }) => await previewTermArchive(getDatabase(), data.termCodes)
  );

export const archiveTerms = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(termCodesSchema.extend({ archived: z.boolean() }))
  .handler(
    async ({ data }) =>
      await setTermsArchived(getDatabase(), {
        archived: data.archived,
        termCodes: data.termCodes,
      })
  );

export const createTerm = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      endDate: z.iso.date(),
      name: z.string().min(1).max(120),
      startDate: z.iso.date(),
      termCode: z.string().regex(TERM_CODE_PATTERN),
    })
  )
  .handler(async ({ data }) => {
    const startDate = new Date(`${data.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${data.endDate}T00:00:00.000Z`);

    if (endDate.getTime() < startDate.getTime()) {
      throw new Error("The end date must not be before the start date.");
    }

    await createAdminTerm(getDatabase(), {
      endDate,
      name: data.name,
      startDate,
      termCode: data.termCode,
    });

    return { termCode: data.termCode };
  });
