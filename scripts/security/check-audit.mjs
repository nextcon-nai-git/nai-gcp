import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const reviewed = new Map([
  ["https://github.com/advisories/GHSA-mrhx-c7xc-m3w5", "zod"],
  ["https://github.com/advisories/GHSA-jmr9-qjv8-65gv", "extract-zip"],
  ["https://github.com/advisories/GHSA-7pqw-9j4j-h8q3", "extract-zip"],
]);

export function assessAudit(report) {
  if (
    report.error ||
    report.auditReportVersion !== 2 ||
    !report.metadata?.vulnerabilities ||
    !report.vulnerabilities
  )
    throw new Error("Invalid or unavailable npm audit report");
  if (report.metadata.vulnerabilities.critical)
    throw new Error("Critical dependency vulnerability");
  const high = Object.values(report.vulnerabilities).filter((v) =>
    ["high", "critical"].includes(v.severity)
  );
  if (high.length !== report.metadata.vulnerabilities.high)
    throw new Error("Inconsistent audit summary");
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
      if (owner.nodes.length !== 1 || owner.nodes[0] !== `node_modules/${name}`)
        throw new Error(`Unpatched nested dependency: ${owner.name}`);
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
