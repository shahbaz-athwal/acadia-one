#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FacultyProfessorDirectorySchema,
  type FacultyProfessor,
  shouldProcessFacultyDepartment,
} from "../convex/lib/professorEnrichment";

interface CliOptions {
  department?: string;
  resumeFrom?: string;
  dryRun: boolean;
}

interface DepartmentEnrichmentResult {
  departmentPrefix: string;
  departmentName: string;
  total: number;
  autoMatched: number;
  agentMatched: number;
  updated: number;
  skippedNoMatch: number;
  skippedLowConfidence: number;
  skippedNoData: number;
  warnings: string[];
  unmatchedNames: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg.startsWith("--department=")) {
      options.department = arg.slice("--department=".length).trim().toUpperCase();
      continue;
    }

    if (arg.startsWith("--resume-from=")) {
      options.resumeFrom = arg
        .slice("--resume-from=".length)
        .trim()
        .toUpperCase();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runDepartmentWorkflow(
  repoRoot: string,
  payload: {
    departmentPrefix: string;
    departmentName: string;
    warnings: string[];
    professors: FacultyProfessor[];
    dryRun: boolean;
  }
) {
  const result = spawnSync(
    "bunx",
    [
      "convex",
      "run",
      "--typecheck",
      "disable",
      "--codegen",
      "disable",
      "workflow/professorEnrichment:enrichDepartmentProfessors",
      JSON.stringify(payload),
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    }
  );

  if (result.status !== 0) {
    throw new Error(
      [result.stderr, result.stdout].filter(Boolean).join("\n").trim()
    );
  }

  const output = result.stdout.trim();
  if (!output) {
    throw new Error("Convex workflow returned no output.");
  }

  try {
    return JSON.parse(output) as DepartmentEnrichmentResult;
  } catch (error) {
    throw new Error(
      `Failed to parse Convex workflow output as JSON.\n${output}\n${String(error)}`
    );
  }
}

function printDepartmentResult(
  result: DepartmentEnrichmentResult,
  dryRun: boolean
) {
  const updatedLabel = dryRun ? "would update" : "updated";
  console.log(
    [
      `${result.departmentPrefix} ${result.departmentName}`,
      `total=${result.total}`,
      `autoMatched=${result.autoMatched}`,
      `agentMatched=${result.agentMatched}`,
      `${updatedLabel}=${result.updated}`,
      `skippedNoMatch=${result.skippedNoMatch}`,
      `skippedLowConfidence=${result.skippedLowConfidence}`,
      `skippedNoData=${result.skippedNoData}`,
    ].join(" | ")
  );

  if (result.warnings.length > 0) {
    console.log(`  warnings: ${result.warnings.join(" ; ")}`);
  }

  if (result.unmatchedNames.length > 0) {
    console.log(`  unmatched: ${result.unmatchedNames.join(", ")}`);
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(currentFilePath), "..");
const options = parseArgs(process.argv.slice(2));
const jsonPath = resolve(repoRoot, "professors-by-department.json");
const rawJson = await readFile(jsonPath, "utf8");
const professorDirectory = FacultyProfessorDirectorySchema.parse(
  JSON.parse(rawJson)
);

let departments = professorDirectory.departments.filter(
  shouldProcessFacultyDepartment
);

if (options.department) {
  departments = departments.filter(
    (department) => department.prefix === options.department
  );
}

if (options.resumeFrom) {
  const resumeIndex = departments.findIndex(
    (department) => department.prefix === options.resumeFrom
  );
  if (resumeIndex === -1) {
    throw new Error(
      `Could not find resumable department prefix: ${options.resumeFrom}`
    );
  }
  departments = departments.slice(resumeIndex);
}

if (departments.length === 0) {
  console.log("No departments matched the provided filters.");
  process.exit(0);
}

const results: DepartmentEnrichmentResult[] = [];

for (const [index, department] of departments.entries()) {
  console.log(
    `[${index + 1}/${departments.length}] Processing ${department.prefix} ${department.department}`
  );

  const result = runDepartmentWorkflow(repoRoot, {
    departmentPrefix: department.prefix,
    departmentName: department.department,
    warnings: department.warnings,
    professors: department.professors,
    dryRun: options.dryRun,
  });
  results.push(result);
  printDepartmentResult(result, options.dryRun);
}

const totals = results.reduce(
  (acc, result) => {
    acc.total += result.total;
    acc.autoMatched += result.autoMatched;
    acc.agentMatched += result.agentMatched;
    acc.updated += result.updated;
    acc.skippedNoMatch += result.skippedNoMatch;
    acc.skippedLowConfidence += result.skippedLowConfidence;
    acc.skippedNoData += result.skippedNoData;
    return acc;
  },
  {
    total: 0,
    autoMatched: 0,
    agentMatched: 0,
    updated: 0,
    skippedNoMatch: 0,
    skippedLowConfidence: 0,
    skippedNoData: 0,
  }
);

console.log("");
console.log("Summary");
console.log(
  [
    `departments=${results.length}`,
    `total=${totals.total}`,
    `autoMatched=${totals.autoMatched}`,
    `agentMatched=${totals.agentMatched}`,
    `${options.dryRun ? "wouldUpdate" : "updated"}=${totals.updated}`,
    `skippedNoMatch=${totals.skippedNoMatch}`,
    `skippedLowConfidence=${totals.skippedLowConfidence}`,
    `skippedNoData=${totals.skippedNoData}`,
  ].join(" | ")
);
