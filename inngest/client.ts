import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

export const inngest = new Inngest({
  id: "dryft",
  schemas: new EventSchemas().fromSchema({
    "course/process": z.object({
      courseId: z.string(),
      sectionIds: z.array(z.string()),
      departmentPrefix: z.string(),
    }),
    "populate/acadia-department-professors": z.object({}),
    "sync/link-professors-with-rmp": z.object({}),
    "courses/populate": z.object({}),
    "courses/trigger-processing": z.object({}),
    "populate/departments": z.object({}),
    "rmp/pull-reviews": z.object({
      rmpId: z.string(),
      professorId: z.string(),
    }),
    "rmp/trigger-reviews-pulling": z.object({}),
    "file/screen": z.object({
      fileId: z.string(),
      fileKey: z.string(),
      courseName: z.string(),
      mimeType: z.string(),
    }),
  }),
});
