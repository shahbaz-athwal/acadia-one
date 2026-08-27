import { getDatabase } from "@/db";
import type { Database } from "@/db";
import { departments, professorDepartments, professors } from "@/db/schema";
import type { ProfessorId } from "@/db/schema";
import type {
  AcadiaExtractor,
  AcadiaProfessor,
} from "@/server/acadia/extractor";

interface ImportProfessorsOptions {
  readonly database?: Database;
  readonly extractor: AcadiaExtractor;
}

interface ProfessorDepartmentMembership {
  readonly departmentPrefix: string;
  readonly professorId: ProfessorId;
}

export async function importProfessors({
  database = getDatabase(),
  extractor,
}: ImportProfessorsOptions) {
  const departmentRows = await database
    .select({ prefix: departments.prefix })
    .from(departments);

  if (departmentRows.length === 0) {
    throw new Error("Cannot import professors before departments are seeded.");
  }

  const professorsById = new Map<ProfessorId, AcadiaProfessor>();
  const membershipsByKey = new Map<string, ProfessorDepartmentMembership>();

  for (const department of departmentRows) {
    // Keep portal requests sequential so a full import does not burst traffic.
    const departmentProfessorsResult =
      // oxlint-disable-next-line no-await-in-loop
      await extractor.getProfessorsByDepartment(department.prefix);

    if (departmentProfessorsResult.isErr()) {
      throw new Error(departmentProfessorsResult.error.message, {
        cause: departmentProfessorsResult.error,
      });
    }

    for (const professor of departmentProfessorsResult.value) {
      professorsById.set(professor.id, professor);

      const membership = {
        departmentPrefix: department.prefix,
        professorId: professor.id,
      };
      membershipsByKey.set(
        `${membership.professorId}:${membership.departmentPrefix}`,
        membership
      );
    }
  }

  const professorRows = [...professorsById.values()];
  const membershipRows = [...membershipsByKey.values()];

  if (professorRows.length === 0) {
    throw new Error(
      "Acadia returned no professors; existing data was not changed."
    );
  }

  database.transaction((transaction) => {
    for (const professor of professorRows) {
      transaction
        .insert(professors)
        .values({ id: professor.id, name: professor.name })
        .onConflictDoUpdate({
          set: { name: professor.name },
          target: professors.id,
        })
        .run();
    }

    transaction.delete(professorDepartments).run();

    for (const membership of membershipRows) {
      transaction.insert(professorDepartments).values(membership).run();
    }
  });

  return {
    departments: departmentRows.length,
    professorDepartments: membershipRows.length,
    professors: professorRows.length,
  };
}
