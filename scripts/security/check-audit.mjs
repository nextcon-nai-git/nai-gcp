import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { applyDependencyPatches, reviewedDependencyPaths } from "./apply-dependency-patches.mjs";

const reviewed = new Map([
  ["https://github.com/advisories/GHSA-mrhx-c7xc-m3w5", "zod"],
  ["https://github.com/advisories/GHSA-jmr9-qjv8-65gv", "extract-zip"],
  ["https://github.com/advisories/GHSA-7pqw-9j4j-h8q3", "extract-zip"],
]);

const severities = ["info", "low", "moderate", "high", "critical"];
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const invalidReport = (reason) => new Error(`Invalid or unavailable npm audit report: ${reason}`);

function validateReport(report) {
  if (
    !isRecord(report) ||
    report.error ||
    report.auditReportVersion !== 2 ||
    !isRecord(report.metadata) ||
    !isRecord(report.metadata.vulnerabilities) ||
    !isRecord(report.vulnerabilities)
  )
    throw invalidReport("unexpected report structure");
  const entries = Object.entries(report.vulnerabilities);
  const counts = Object.fromEntries(severities.map((severity) => [severity, 0]));
  for (const [name, vulnerability] of entries) {
    if (
      !isText(name) ||
      !isRecord(vulnerability) ||
      vulnerability.name !== name ||
      !severities.includes(vulnerability.severity) ||
      !Array.isArray(vulnerability.nodes) ||
      !vulnerability.nodes.length ||
      !vulnerability.nodes.every(isText) ||
      !Array.isArray(vulnerability.via) ||
      !vulnerability.via.length
    )
      throw invalidReport("invalid vulnerability entry");
    counts[vulnerability.severity]++;
    for (const via of vulnerability.via) {
      if (typeof via === "string") {
        if (!isText(via) || !Object.hasOwn(report.vulnerabilities, via))
          throw invalidReport("unknown audit dependency");
        // A named dependency aggregates its own advisories. Its maximum severity may
        // exceed the subset affecting this dependent; do not equate the two severities.
        continue;
      }
      if (
        !isRecord(via) ||
        !isText(via.name) ||
        !isText(via.url) ||
        !severities.includes(via.severity)
      )
        throw invalidReport("invalid advisory entry");
      if (severities.indexOf(via.severity) > severities.indexOf(vulnerability.severity))
        throw invalidReport("advisory severity exceeds package severity");
    }
  }
  // npm v2 counts affected packages, including propagated findings, not advisories.
  // high/critical are mandatory for the gate. Validate other counters when provided.
  const summary = report.metadata.vulnerabilities;
  for (const severity of severities) {
    if (!["high", "critical"].includes(severity) && !Object.hasOwn(summary, severity)) continue;
    if (!isCount(summary[severity]) || summary[severity] !== counts[severity])
      throw invalidReport("inconsistent vulnerability counters");
  }
  if (
    Object.hasOwn(summary, "total") &&
    (!isCount(summary.total) || summary.total !== entries.length)
  )
    throw invalidReport("inconsistent vulnerability total");
  return entries.map(([, vulnerability]) => vulnerability);
}

export function assessAudit(report, { root } = {}) {
  const vulnerabilities = validateReport(report);
  if (report.metadata.vulnerabilities.critical)
    throw new Error("Critical dependency vulnerability");
  const high = vulnerabilities.filter((v) => ["high", "critical"].includes(v.severity));
  const reviewedNodes = reviewedDependencyPaths();
  let verifiedNodes;
  function origins(v, seen = new Set()) {
    if (seen.has(v.name)) return [];
    const next = new Set([...seen, v.name]);
    return v.via.flatMap((via) => {
      if (typeof via !== "string")
        return ["high", "critical"].includes(via.severity) ? [{ advisory: via, owner: v }] : [];
      const inherited = report.vulnerabilities[via];
      if (!inherited) throw new Error(`Unknown audit dependency: ${via}`);
      return origins(inherited, next);
    });
  }
  for (const v of high) {
    const causes = origins(v);
    if (!causes.length) throw new Error(`Unexplained high vulnerability: ${v.name}`);
    for (const { advisory, owner } of causes) {
      const name = reviewed.get(advisory.url);
      if (advisory.severity !== "high" || !name || advisory.name !== name || owner.name !== name)
        throw new Error(`Unpatched vulnerability: ${advisory.url || v.name}`);
      if (
        owner.nodes.some(
          (node) => !reviewedNodes.some((entry) => entry.name === name && entry.path === node)
        )
      )
        throw new Error(`Unpatched nested dependency: ${owner.name}`);
      // A path in the manifest is not proof by itself: version, exact patched
      // bytes and every bundled v4 tree must match before accepting its finding.
      verifiedNodes ||= applyDependencyPatches({ root, check: true });
      if (owner.nodes.some((node) => !verifiedNodes.get(name)?.has(node)))
        throw new Error(`Unverified dependency installation: ${owner.name}`);
    }
  }
  return { raw: report.metadata.vulnerabilities, backportedHighPackages: high.map((v) => v.name) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./apply-dependency-patches.mjs", import.meta.url)), "--check"],
    { stdio: "inherit" }
  );
  let output;
  try {
    output = execFileSync("npm", ["audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 180_000,
    });
  } catch (error) {
    if (error.status !== 1 || !error.stdout) throw error;
    output = error.stdout;
  }
  if (process.argv[2]) writeFileSync(process.argv[2], output);
  const result = assessAudit(JSON.parse(output));
  console.log(JSON.stringify(result, null, 2));
  console.log(
    "No unpatched high/critical findings. Raw version-based findings above are retained, not suppressed."
  );
}
