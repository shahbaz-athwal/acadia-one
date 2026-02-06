"use node";

import type { AxiosInstance } from "axios";
import type { ActionCtx } from "../../_generated/server";
import { createClient } from "./auth";
import { ProgramEvaluationFilteredResponseSchema } from "./schemas/programEvaluation";
import { StudentGradesFilteredResponseSchema } from "./schemas/studentGrades";
import { StudentProgramDetailsFilteredResponseSchema } from "./schemas/studentProgram";

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
}

export function getAcadiaImpersonator(
  _ctx: ActionCtx,
  _provider: string,
  _studentId: string
) {
  throw new Error("getAcadiaImpersonator not implemented yet");
}
