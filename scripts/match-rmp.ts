import { createDatabase } from "../src/db/index";
import { matchRmpToAcadia } from "../src/server/workflows/match-rmp-acadia";
import type { MatchMethod } from "../src/server/workflows/match-rmp-acadia";

const deterministicOnly = process.argv.includes("--deterministic-only");
const dryRun = process.argv.includes("--dry-run");
const verbose = process.argv.includes("--verbose");

const database = createDatabase();

function write(line: string) {
  process.stdout.write(`${line}\n`);
}

try {
  const report = await matchRmpToAcadia({
    database,
    deterministicOnly,
    dryRun,
  });

  write(
    `${report.professors} local professors vs ${report.teachers} RMP teachers`
  );
  write("");

  const methods: MatchMethod[] = [
    "exact",
    "initial",
    "fuzzy",
    "ai",
    "unmatched",
  ];

  for (const method of methods) {
    const count = report.byMethod[method];
    const share = ((count / report.professors) * 100).toFixed(1);

    write(`  ${method.padEnd(10)} ${String(count).padStart(4)}  (${share}%)`);
  }

  write("");

  if (report.usage === null) {
    write("No model call was made.");
  } else {
    write(
      `${report.usage.model}: ${report.usage.inputTokens} in / ${report.usage.outputTokens} out`
    );
  }

  if (verbose) {
    write("");

    for (const match of report.matches) {
      write(
        `  [${match.method}] ${match.professorName} -> ${match.rmpId ?? "none"}  ${match.reason}`
      );
    }
  }

  write("");
  write(
    dryRun
      ? "Dry run: nothing was written."
      : `Wrote ${report.written} rmpId values. Run \`bun run db:snapshot\` to freeze them.`
  );
} finally {
  database.$client.close();
}
