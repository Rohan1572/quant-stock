/**
 * Fails on any npm audit advisory except the ones explicitly accepted below.
 *
 * `npm audit fix` cannot always help — some advisories have no patched release
 * at all — and a permanently red audit train just gets ignored. So each accepted
 * advisory is listed with the reason it is tolerable, and anything new — a fresh
 * CVE, a new transitive, a severity change — still fails the build. An accepted
 * entry that is no longer reported also fails, so it cannot outlive its problem.
 *
 * Currently empty: `npm audit` reports zero advisories.
 *
 * Run with `npm run audit:vulns`.
 */
import { execFileSync } from "node:child_process";

/**
 * Advisory -> why it is accepted. Delete an entry once a fix ships, or once the
 * dependency is no longer reachable, and the audit goes back to failing on it.
 *
 * Empty, because nothing is accepted today: `npm audit` reports zero
 * advisories. The mechanism stays so a future unfixable one is a reviewed
 * decision with a written justification rather than a silent pass, and so the
 * stale check keeps accepted entries from outliving the problem.
 */
const ACCEPTED = {};

function auditJson() {
  // npm audit exits non-zero when it finds anything, which is the normal path
  // here, so the status is ignored and the JSON report is what matters.
  // On Windows `npm` is a .cmd shim, which Node refuses to spawn directly
  // (EINVAL), so it is invoked through cmd there. The arguments are literals,
  // never interpolated from input, which is what Node's shell deprecation warns
  // about.
  const isWindows = process.platform === "win32";
  const npm = isWindows ? "npm.cmd" : "npm";
  try {
    const stdout = execFileSync(npm, ["audit", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: isWindows,
      maxBuffer: 32 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (err) {
    // execFileSync throws on a non-zero exit but still captures stdout.
    if (err.stdout) return JSON.parse(err.stdout);
    throw err;
  }
}

const report = auditJson();
const advisories = report.vulnerabilities ?? {};

const unexpected = [];
const acceptedSeen = [];

for (const [name, entry] of Object.entries(advisories)) {
  if (ACCEPTED[name]) {
    acceptedSeen.push(name);
    continue;
  }
  unexpected.push(
    `${name} (${entry.severity}) via ${(entry.via ?? [])
      .map((v) => (typeof v === "string" ? v : v.title))
      .join("; ")}`,
  );
}

console.log(`advisories reported: ${Object.keys(advisories).length}`);
console.log(
  `accepted: ${acceptedSeen.length ? acceptedSeen.join(", ") : "none"}`,
);
console.log(`not accepted: ${unexpected.length}`);

for (const line of unexpected) {
  console.error(`  ${line}`);
}

const stale = Object.keys(ACCEPTED).filter(
  (name) => !acceptedSeen.includes(name),
);
if (stale.length > 0) {
  console.error(
    `\nThese accepted advisories are no longer reported, so their entries in ` +
      `ACCEPTED are stale: ${stale.join(", ")}. Remove them.`,
  );
}

if (unexpected.length > 0) {
  console.error(
    "\nFix these, or if no patched release exists, assess the risk and add a " +
      "justified entry to ACCEPTED in scripts/audit-vulnerabilities.mjs.",
  );
  process.exit(1);
}

if (stale.length > 0) {
  process.exit(1);
}
