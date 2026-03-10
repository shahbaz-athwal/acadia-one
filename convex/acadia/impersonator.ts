"use node";

import crypto from "node:crypto";
import type { AxiosInstance } from "axios";
import type { z } from "zod";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { decryptCredentials } from "../lib/encryption";
import {
  authenticateWithAxios,
  createClient,
  isAcadiaSessionExpired,
} from "./auth";
import { DegreePlanPlanningStatusesFilteredResponseSchema } from "./schemas/degreePlanPlanningStatuses";
import {
  PostSearchCriteriaFilteredResponseSchema,
  PostSearchCriteriaRequestSchema,
} from "./schemas/postSearchCriteria";
import { ProgramEvaluationFilteredResponseSchema } from "./schemas/programEvaluation";
import { StudentGradesFilteredResponseSchema } from "./schemas/studentGrades";
import { StudentProgramDetailsFilteredResponseSchema } from "./schemas/studentProgram";

export type {
  CoursePlanningStatus,
  CoursePlanningStatusByCode,
  DegreePlanPlanningStatusesTransformed,
} from "./schemas/degreePlanPlanningStatuses";
export type { ProgramEvaluationTransformed } from "./schemas/programEvaluation";
export type { StudentGradesTransformed } from "./schemas/studentGrades";
export type { StudentProgramDetailsTransformed } from "./schemas/studentProgram";

export class AcadiaImpersonator {
  private readonly client: AxiosInstance;
  private readonly cookies: string;
  private readonly studentId: string;

  constructor(
    studentId: string,
    cookies: string,
    clientInstance: AxiosInstance = createClient()
  ) {
    this.studentId = studentId;
    this.cookies = cookies;
    this.client = clientInstance;

    this.client.interceptors.request.use((config) => {
      config.headers.set("Accept", "application/json");
      config.headers.set("Cookie", this.cookies);
      return config;
    });
  }

  async getStudentProgramDetails() {
    const response = await this.client.get(
      `/student/Student/Grades/GetStudentProgramsInformation?studentId=${this.studentId}`
    );

    return StudentProgramDetailsFilteredResponseSchema.parse(response.data);
  }

  async getStudentGrades() {
    const response = await this.client.get(
      `/student/Student/Grades/GetStudentGradeInformation?studentId=${this.studentId}`
    );

    return StudentGradesFilteredResponseSchema.parse(response.data);
  }

  async getProgramEvaluation(programCode: string) {
    const response = await this.client.post(
      "/student/Planning/Programs/ProgramEvaluation",
      {
        program: programCode,
        isWhatIfEvaluation: true,
        studentId: this.studentId,
      }
    );

    return ProgramEvaluationFilteredResponseSchema.parse(response.data).program;
  }

  async getCoursePlanningStatuses() {
    const response = await this.client.get(
      `/student/Planning/DegreePlans/Current?studentId=${this.studentId}`
    );

    const data =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    return DegreePlanPlanningStatusesFilteredResponseSchema.parse(data);
  }

  private async postSearchCriteria(
    searchCriteria?: Partial<z.infer<typeof PostSearchCriteriaRequestSchema>>
  ) {
    const defaultCriteria = {
      keyword: null,
      terms: [],
      courseIds: null,
      sectionIds: null,
      subjects: [],
      faculty: [],
      pageNumber: 1,
      quantityPerPage: 50,
    };

    const validatedCriteria = PostSearchCriteriaRequestSchema.parse({
      ...defaultCriteria,
      ...searchCriteria,
    });

    const response = await this.client.post(
      "/student/Student/Courses/PostSearchCriteria",
      validatedCriteria
    );

    return PostSearchCriteriaFilteredResponseSchema.parse(response.data);
  }

  async getRequiredCourses(
    group: string,
    requirement: string,
    subrequirement: string
  ) {
    const data = await this.postSearchCriteria({
      group,
      requirement,
      subrequirement,
    });
    return data.courses;
  }
}

function sha256HexFromTokenHex(tokenHex: string): string {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(tokenHex, "hex"))
    .digest("hex");
}

function tokenMatchesHash(tokenHex: string, storedHashHex: string): boolean {
  try {
    const computedHashHex = sha256HexFromTokenHex(tokenHex);
    const computed = Buffer.from(computedHashHex, "hex");
    const stored = Buffer.from(storedHashHex, "hex");
    if (computed.length !== stored.length) {
      return false;
    }
    return crypto.timingSafeEqual(computed, stored);
  } catch {
    return false;
  }
}

export async function getAcadiaImpersonator(
  ctx: ActionCtx,
  sessionId: string,
  decryptionToken: string
): Promise<AcadiaImpersonator> {
  const user = await ctx.runQuery(internal.internal.getAcadiaUser, {
    sessionId,
  });
  if (!user) {
    throw new Error("No user found for this session.");
  }
  if (!tokenMatchesHash(decryptionToken, user.tokenHash)) {
    throw new Error("Invalid token for this session.");
  }

  const session = await ctx.runQuery(internal.internal.getAcadiaSession, {
    sessionId,
  });
  const now = Date.now();
  if (!session || session.expiresAt <= now) {
    throw new Error("Session expired or not found.");
  }

  let cookies = session.cookies;
  if (cookies && !isAcadiaSessionExpired(session.lastAcadiaAuth)) {
    return new AcadiaImpersonator(user.studentId.slice(0, -1), cookies);
  }

  const { username, password } = decryptCredentials(
    user.encryptedCredentials,
    decryptionToken
  );
  if (!cookies || isAcadiaSessionExpired(session.lastAcadiaAuth)) {
    cookies = await authenticateWithAxios(username, password);
    await ctx.runMutation(internal.internal.upsertAcadiaSession, {
      sessionId,
      cookies,
      lastAcadiaAuth: now,
      expiresAt: session.expiresAt,
    });
  }

  return new AcadiaImpersonator(user.studentId.slice(0, -1), cookies);
}
