import { google } from "@ai-sdk/google";
import { presignGetObject } from "@better-upload/server/helpers";
import { withTracing } from "@posthog/ai";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "../services/db";
import { BUCKET_NAME, s3Client } from "../services/file-upload";
import { posthog } from "../services/posthog";
import { inngest } from "./client";

const SCREENING_PROMPT = `
You are a file screening assistant for an educational platform. 
Analyze the uploaded file and determine:

1. **Relevancy**: Is this file related to the course "{courseName}"? 
   - Look for course-specific content like lecture notes, assignments, exams, syllabi, or study materials.
   - Reject files that are clearly unrelated (personal photos, unrelated documents, spam, etc.)

2. **PII Detection**: Does the file contain Personally Identifiable Information?
   - Look for: student names, email addresses, student IDs, phone numbers, addresses, grades with identifiers.
   - General course content without specific student information is acceptable.

3. **Resource Type Classification**: If relevant, categorize the file as:
   - ASSIGNMENT: Homework, problem sets, projects, lab reports
   - NOTES: Lecture notes, study guides, summaries
   - EXAM_PAPER: Past exams, midterms, finals, quizzes
   - CHEAT_SHEET: Formula sheets, quick reference guides
   - SYLLABUS: Course outlines, schedules, policies
   - OTHER: Other course-related materials that don't fit above categories

Respond with your analysis.
`;

export const screenFile = inngest.createFunction(
  {
    id: "screen-file",
    description:
      "Screens uploaded files for relevancy, PII, and classifies resource type using Gemini Flash.\n" +
      "- Checks if file is relevant to the specified course\n" +
      "- Detects personally identifiable information\n" +
      "- Classifies the resource type\n" +
      "- Updates file status in database",
    throttle: {
      limit: 10,
      period: "1m",
    },
  },
  { event: "file/screen" },
  async ({ event, step }) => {
    const { fileId, fileKey, courseName, mimeType } = event.data;

    // Step 1: Get presigned URL from S3
    const presignedUrl = await step.run("get-presigned-url", async () => {
      const url = await presignGetObject(s3Client, {
        bucket: BUCKET_NAME,
        key: fileKey,
        expiresIn: 3600, // 1 hour
      });
      return url;
    });

    // Step 2: Analyze file with Gemini using the presigned URL
    const screeningResult = await step.run("analyze-file", async () => {
      const result = await generateObject({
        model: withTracing(google("gemini-flash-latest"), posthog, {}),
        system: SCREENING_PROMPT,
        schema: z.object({
          isRelevant: z
            .boolean()
            .describe("Whether the file is relevant to the course"),
          hasPII: z
            .boolean()
            .describe(
              "Whether the file contains personally identifiable information (names, emails, student IDs, etc.)"
            ),
          resourceType: z
            .enum([
              "ASSIGNMENT",
              "NOTES",
              "EXAM_PAPER",
              "CHEAT_SHEET",
              "SYLLABUS",
              "OTHER",
            ])
            .nullable()
            .describe("The type of resource if relevant, null if not relevant"),
        }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `The file is for the course ${courseName}`,
              },
              {
                type: "file",
                mediaType: mimeType,
                data: new URL(presignedUrl),
              },
            ],
          },
        ],
      });

      return result.object;
    });

    // Step 3: Update file in database based on screening result
    await step.run("update-file-status", async () => {
      // TODO: Uncomment when ready to update File.status in database
      // let status: string;
      // if (!screeningResult.isRelevant) {
      //   status = "REJECTED";
      // } else if (screeningResult.hasPII) {
      //   status = "AI_FLAGGED";
      // } else {
      //   status = "APPROVED";
      // }

      await db.file.update({
        where: { id: fileId },
        data: {
          resourceType: screeningResult.isRelevant
            ? screeningResult.resourceType
            : null,
          // TODO: Uncomment when ready to update status
          // status,
        },
      });

      // TODO: If hasPII is true, trigger another function to handle PII redaction or review
      // if (screeningResult.hasPII) {
      //   await inngest.send({
      //     name: "file/redact-pii",
      //     data: { fileId },
      //   });
      // }
    });

    return {
      fileId,
      ...screeningResult,
    };
  }
);
