"use node";

import type { AxiosInstance } from "axios";
import type { z } from "zod";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  authenticateWithAxios,
  createClient,
  DEFAULT_AUTH_TIMEOUT_MS,
} from "./auth";
import {
  PostSearchCriteriaFilteredResponseSchema,
  PostSearchCriteriaRequestSchema,
} from "./schemas/postSearchCriteria";
import { ProgramEvaluationFilteredResponseSchema } from "./schemas/programEvaluation";
import { SectionDetailsFilteredResponseSchema } from "./schemas/section";

const ACADIA_SESSION_ID = "default";

export class AcadiaScraper {
  private readonly client: AxiosInstance;
  private readonly cookies: string;

  constructor(cookies: string, clientInstance: AxiosInstance = createClient()) {
    this.cookies = cookies;
    this.client = clientInstance;

    this.client.interceptors.request.use((config) => {
      config.headers.set("Accept", "application/json");
      config.headers.set("Cookie", this.cookies);
      return config;
    });
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

  async getAllDepartments() {
    const data = await this.postSearchCriteria();
    return data.subjects;
  }

  async getFacultiesByDepartment(departmentPrefix: string) {
    const data = await this.postSearchCriteria({
      subjects: [departmentPrefix],
    });
    return data.faculties;
  }

  async getAllCourses() {
    const data = await this.postSearchCriteria({ quantityPerPage: 3000 });
    return data.courses;
  }

  async getSectionDetails(courseId: string, sectionIds: string[]) {
    const response = await this.client.post(
      "/student/Student/Courses/Sections",
      {
        courseId,
        sectionIds,
      }
    );
    return SectionDetailsFilteredResponseSchema.parse(response.data);
  }

  async getProgramEvaluation(studentId: string, programCode: string) {
    const response = await this.client.post(
      "/student/Planning/Programs/ProgramEvaluation",
      {
        program: programCode,
        isWhatIfEvaluation: true,
        studentId,
      }
    );

    return ProgramEvaluationFilteredResponseSchema.parse(response.data).program;
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

export async function getAcadiaScraper(ctx: ActionCtx) {
  const storedSession = await ctx.runQuery(internal.internal.getAcadiaSession, {
    sessionId: ACADIA_SESSION_ID,
  });
  const now = Date.now();
  if (storedSession?.cookies && storedSession.expiresAt > now) {
    return new AcadiaScraper(storedSession.cookies);
  }

  const username = process.env.ACADIA_USERNAME;
  const password = process.env.ACADIA_PASSWORD;
  if (!username) {
    throw new Error("ACADIA_USERNAME is not set");
  }
  if (!password) {
    throw new Error("ACADIA_PASSWORD is not set");
  }

  const cookies = await authenticateWithAxios(username, password);

  const expiresAt = now + DEFAULT_AUTH_TIMEOUT_MS;
  await ctx.runMutation(internal.internal.upsertAcadiaSession, {
    sessionId: ACADIA_SESSION_ID,
    cookies,
    lastAcadiaAuth: now,
    expiresAt,
  });
  return new AcadiaScraper(cookies);
}
