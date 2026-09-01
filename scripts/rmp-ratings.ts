import { createDatabase } from "../src/db/index";
import { importRmpRatings } from "../src/server/workflows/rmp-ratings";

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const verbose = process.argv.includes("--verbose");

const limitFlag = process.argv.indexOf("--limit");
const limit =
  limitFlag === -1
    ? undefined
    : Number.parseInt(process.argv[limitFlag + 1] ?? "", 10);

if (limit !== undefined && Number.isNaN(limit)) {
  process.stderr.write("--limit needs a number.\n");
  process.exit(1);
}

const database = createDatabase();

function write(line: string) {
  process.stdout.write(`${line}\n`);
}

const MS_PER_SECOND = 1000;
const PERCENT = 100;

const startedAt = Date.now();

try {
  const report = await importRmpRatings({
    database,
    dryRun,
    force,
    limit,
    onProgress: (progress) => {
      if (
        progress.completed % 25 === 0 ||
        progress.completed === progress.total
      ) {
        write(`  ${progress.completed} / ${progress.total} ${progress.unit}`);
      }
    },
  });

  const { counts } = report;
  const wall = (Date.now() - startedAt) / MS_PER_SECOND;

  write("");
  write(
    `${counts.professors} matched professors in ${wall.toFixed(1)}s (${counts.requests} RMP requests)`
  );
  write(
    `  pulled ${counts.professorsPulled}  skipped ${counts.professorsSkipped}  failed ${counts.professorsFailed}`
  );
  write("");
  write(`  reviews fetched   ${String(counts.ratingsFetched).padStart(6)}`);
  write(`  inserted          ${String(counts.ratingsInserted).padStart(6)}`);
  write(`  updated in place  ${String(counts.ratingsUpdated).padStart(6)}`);

  const written = counts.ratingsLinked + counts.ratingsUnlinked;

  if (written > 0) {
    const linkedShare = ((counts.ratingsLinked / written) * PERCENT).toFixed(1);
    const unlinkedShare = (
      (counts.ratingsUnlinked / written) *
      PERCENT
    ).toFixed(1);

    write("");
    write(
      `  linked to a course   ${String(counts.ratingsLinked).padStart(6)}  (${linkedShare}%)`
    );
    write(
      `  kept without one     ${String(counts.ratingsUnlinked).padStart(6)}  (${unlinkedShare}%)`
    );
    write("  (the second group is what the previous implementation discarded)");
  }

  if (report.rosterWarning !== null) {
    write("");
    write(
      `Roster lookup failed, so nothing was skipped: ${report.rosterWarning}`
    );
  }

  const failures = report.professors.filter(
    (entry) => entry.status === "failed"
  );

  if (failures.length > 0) {
    write("");
    write(`${failures.length} professor(s) failed:`);
    for (const failure of failures) {
      write(`  ${failure.professorName}: ${failure.errorMessage ?? "unknown"}`);
    }
  }

  if (verbose) {
    write("");
    for (const entry of report.professors) {
      const detail =
        entry.status === "skipped"
          ? (entry.skipReason ?? "")
          : `fetched ${entry.fetched}, +${entry.inserted} new, ~${entry.updated} rewritten, ${entry.requests} req, ${entry.durationMs}ms`;

      write(`  [${entry.status}] ${entry.professorName}: ${detail}`);
    }
  }

  write("");
  write(dryRun ? "Dry run: nothing was written." : "Done.");
} finally {
  database.$client.close();
}
