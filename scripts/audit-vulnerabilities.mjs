/**
 * Fails on any npm audit advisory except the ones explicitly accepted below.
 *
 * `npm audit fix` cannot help when no patched release exists, and a permanently
 * red audit train gets ignored. So each accepted advisory is listed with the
 * reason it is tolerable, and anything new — a fresh CVE, a new transitive, a
 * severity change — still fails the build.
 *
 * Run with `npm run audit:vulns`.
 */
import { execFileSync } from "node:child_process";

/**
 * Advisory -> why it is accepted. Delete an entry once a fix ships, or once the
 * dependency is no longer reachable, and the audit goes back to failing on it.
 */
const ACCEPTED = {
  braces: {
    advisory: "GHSA-vfj7-8cjw-p6xm / CVE-2026-93687",
    reason:
      "Root of the advisory: stack exhaustion via deeply nested brace " +
      "patterns in braces' recursive walkers. Reached through fast-glob -> " +
      "micromatch in @workspace/mockup-sandbox, which passes exactly one " +
      "pattern: the literal 'src/components/mockups/**/*.tsx' in " +
      "mockupPreviewPlugin.ts. That is developer-authored source, never user " +
      "input, and braces caps input at 1000 characters, bounding nesting " +
      "depth below the overflow threshold. No patched braces exists (3.0.3 is " +
      "latest). Revisit when one ships.",
  },
  // npm audit reports the whole path, so the two intermediates appear as their
  // own entries. Neither carries an independent finding — dropping either
  // drops braces too — so they inherit its justification.
  micromatch: {
    advisory: "GHSA-vfj7-8cjw-p6xm via braces",
    reason: "Intermediary in the braces advisory. See the braces entry.",
  },
  "fast-glob": {
    advisory: "GHSA-vfj7-8cjw-p6xm via micromatch",
    reason:
      "Intermediary in the braces advisory, declared directly by " +
      "@workspace/mockup-sandbox. See the braces entry for why the reachable " +
      "input is a developer-authored literal rather than user input.",
  },
};

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
