import assert from "node:assert/strict";
import { test } from "node:test";
import { assessAudit } from "../../scripts/security/check-audit.mjs";

const reviewed = {
  zod: "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5",
  zipTraversal: "https://github.com/advisories/GHSA-jmr9-qjv8-65gv",
  zipWrite: "https://github.com/advisories/GHSA-7pqw-9j4j-h8q3",
};
const invalid = /Invalid or unavailable npm audit report/;
const advisory = (name, severity = "high", url = reviewed[name]) => ({
  source: 12345,
  name,
  dependency: name,
  title: "Synthetic audit fixture",
  url: url || "https://example.invalid/advisory",
  severity,
  cwe: [],
  cvss: { score: 0, vectorString: null },
  range: "*",
});
const vulnerability = (name, severity = "high", via = [advisory(name, severity)]) => ({
  name,
  severity,
  isDirect: false,
  via,
  effects: [],
  range: "*",
  nodes: [`node_modules/${name}`],
  fixAvailable: false,
});
function report(vulnerabilities = {}) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const value of Object.values(vulnerabilities)) {
    counts[value.severity]++;
    counts.total++;
  }
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: {
      vulnerabilities: counts,
      dependencies: { prod: 10, dev: 10, optional: 0, peer: 0, peerOptional: 0, total: 20 },
    },
  };
}
const patched = () => report({ zod: vulnerability("zod") });

test("accepts a legitimate empty npm v2 report without changing the raw counts", () => {
  const input = report();
  const before = structuredClone(input);
  assert.deepEqual(assessAudit(input), {
    raw: input.metadata.vulnerabilities,
    backportedHighPackages: [],
  });
  assert.deepEqual(input, before);
});

test("counts affected packages rather than advisories and retains propagated findings", () => {
  const input = report({
    "extract-zip": vulnerability("extract-zip", "high", [
      advisory("extract-zip", "high", reviewed.zipTraversal),
      advisory("extract-zip", "high", reviewed.zipWrite),
    ]),
    "synthetic-cli": vulnerability("synthetic-cli", "high", ["extract-zip"]),
  });
  assert.equal(input.metadata.vulnerabilities.high, 2);
  assert.deepEqual(assessAudit(input).backportedHighPackages, ["extract-zip", "synthetic-cli"]);
});

test("accepts legitimate lower-severity dependents of an aggregated patched dependency", () => {
  const input = report({
    zod: vulnerability("zod", "high", [advisory("zod"), advisory("zod", "low")]),
    "subset-dependent": vulnerability("subset-dependent", "moderate", ["zod"]),
    informational: vulnerability("informational", "info"),
  });
  input.vulnerabilities.zod.fixAvailable = { name: "zod", version: "4.6.7", isSemVerMajor: true };
  input.vulnerabilities.zod.fixBlockedByReleaseAge = { version: "4.6.7", before: "2026-10-01" };
  assert.deepEqual(assessAudit(input).backportedHighPackages, ["zod"]);
  assert.equal(assessAudit(input).raw.moderate, 1);
});

test("does not impose unrelated npm fields on a valid policy-relevant report", () => {
  const input = patched();
  input.metadata.vulnerabilities = { high: 1, critical: 0 };
  delete input.metadata.dependencies;
  delete input.vulnerabilities.zod.fixAvailable;
  assert.deepEqual(assessAudit(input).backportedHighPackages, ["zod"]);
});

test("preserves exactly the three reviewed advisory exceptions", () => {
  for (const [name, url] of [
    ["zod", reviewed.zod],
    ["extract-zip", reviewed.zipTraversal],
    ["extract-zip", reviewed.zipWrite],
  ]) {
    const input = report({ [name]: vulnerability(name, "high", [advisory(name, "high", url)]) });
    assert.deepEqual(assessAudit(input).backportedHighPackages, [name]);
    input.vulnerabilities[name].via[0].url += "?not-the-reviewed-advisory";
    assert.throws(() => assessAudit(input), /Unpatched vulnerability/);
  }
});

test("blocks valid critical findings independently of the reviewed URL", () => {
  const input = report({ zod: vulnerability("zod", "critical") });
  assert.throws(() => assessAudit(input), /Critical dependency vulnerability/);
});

test("blocks unreviewed high findings and additional origins beside a reviewed one", () => {
  assert.throws(
    () => assessAudit(report({ unknown: vulnerability("unknown") })),
    /Unpatched vulnerability/
  );
  const input = patched();
  input.vulnerabilities.zod.via.push(advisory("zod", "high", "https://example.invalid/new"));
  assert.throws(() => assessAudit(input), /Unpatched vulnerability/);
});

test("does not extend a reviewed exception to another owner or advisory name", () => {
  const owner = report({ other: vulnerability("other", "high", [advisory("zod")]) });
  assert.throws(() => assessAudit(owner), /Unpatched vulnerability/);
  const name = patched();
  name.vulnerabilities.zod.via[0].name = "other";
  assert.throws(() => assessAudit(name), /Unpatched vulnerability/);
});

test("accepts only the explicitly reviewed and byte-verified Genkit copies", () => {
  const input = patched();
  input.vulnerabilities.zod.nodes = [
    "node_modules/@genkit-ai/core/node_modules/zod",
    "node_modules/@genkit-ai/telemetry-server/node_modules/zod",
    "node_modules/@genkit-ai/tools-common/node_modules/zod",
  ];
  assert.deepEqual(assessAudit(input).backportedHighPackages, ["zod"]);
  input.vulnerabilities.zod.via.push(advisory("zod", "high", "https://example.invalid/new"));
  assert.throws(() => assessAudit(input), /Unpatched vulnerability/);
});

test("does not extend a reviewed exception to unreviewed nested or aliased installations", () => {
  for (const nodes of [
    ["node_modules/other/node_modules/zod"],
    ["node_modules/zod", "node_modules/other/node_modules/zod"],
    ["node_modules/zod-security-v4"],
  ]) {
    const input = patched();
    input.vulnerabilities.zod.nodes = nodes;
    assert.throws(() => assessAudit(input), /Unpatched nested dependency/);
  }
});

test("rejects arrays, null and scalar values in report object positions", () => {
  for (const value of [null, [], "not-an-object", 1, true]) {
    assert.throws(() => assessAudit(value), invalid);
    for (const field of ["metadata", "vulnerabilities"]) {
      const input = report();
      input[field] = value;
      assert.throws(() => assessAudit(input), invalid);
    }
    const summary = report();
    summary.metadata.vulnerabilities = value;
    assert.throws(() => assessAudit(summary), invalid);
    const entry = patched();
    entry.vulnerabilities.zod = value;
    assert.throws(() => assessAudit(entry), invalid);
  }
});

test("rejects error reports and unsupported report versions", () => {
  for (const auditReportVersion of [undefined, 1, "2", 3]) {
    assert.throws(() => assessAudit({ ...report(), auditReportVersion }), invalid);
  }
  assert.throws(() => assessAudit({ ...report(), error: { code: "ENETUNREACH" } }), invalid);
});

test("rejects unknown package and advisory severities before filtering findings", () => {
  for (const severity of [undefined, null, "unexpected", "HIGH", "", 0]) {
    const packageSeverity = patched();
    packageSeverity.vulnerabilities.zod.severity = severity;
    assert.throws(() => assessAudit(packageSeverity), invalid);
    const advisorySeverity = patched();
    advisorySeverity.vulnerabilities.zod.via[0].severity = severity;
    assert.throws(() => assessAudit(advisorySeverity), invalid);
  }
});

test("rejects a high or critical direct advisory hidden below the package severity", () => {
  for (const severity of ["high", "critical"]) {
    const input = report({
      zod: vulnerability("zod", "moderate", [advisory("zod", severity)]),
    });
    assert.equal(input.metadata.vulnerabilities.high, 0);
    assert.equal(input.metadata.vulnerabilities.critical, 0);
    assert.throws(() => assessAudit(input), /advisory severity exceeds package severity/);
  }
});

test("rejects invalid, missing and nonintegral vulnerability counters", () => {
  for (const value of [undefined, null, "0", -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const key of ["high", "critical", "moderate", "total"]) {
      const input = report();
      input.metadata.vulnerabilities[key] = value;
      assert.throws(() => assessAudit(input), invalid);
    }
  }
  for (const key of ["high", "critical"]) {
    const input = report();
    delete input.metadata.vulnerabilities[key];
    assert.throws(() => assessAudit(input), invalid);
  }
});

test("rejects inconsistent per-severity counts and total even when high is zero", () => {
  for (const key of ["info", "low", "moderate", "high", "critical", "total"]) {
    const input = report();
    input.metadata.vulnerabilities[key] = 1;
    assert.throws(() => assessAudit(input), invalid);
  }
  const input = patched();
  input.metadata.vulnerabilities.high = 0;
  assert.throws(() => assessAudit(input), invalid);
});

test("rejects mismatched names and malformed node lists", () => {
  const mismatch = patched();
  mismatch.vulnerabilities.zod.name = "different-name";
  assert.throws(() => assessAudit(mismatch), invalid);
  for (const nodes of [undefined, null, {}, "node_modules/zod", [], [null], [""]]) {
    const input = patched();
    input.vulnerabilities.zod.nodes = nodes;
    assert.throws(() => assessAudit(input), invalid);
  }
});

test("rejects malformed origin arrays and advisory entries in lower-severity findings too", () => {
  for (const via of [undefined, null, {}, "zod", [], [null], [[]], [{}], [1]]) {
    const input = report({ lower: vulnerability("lower", "moderate") });
    input.vulnerabilities.lower.via = via;
    assert.throws(() => assessAudit(input), invalid);
  }
  for (const key of ["name", "url"]) {
    const input = patched();
    delete input.vulnerabilities.zod.via[0][key];
    assert.throws(() => assessAudit(input), invalid);
  }
});

test("rejects missing and inherited dependency references", () => {
  for (const reference of ["missing", "toString", "constructor", ""]) {
    const input = report({ consumer: vulnerability("consumer", "moderate", [reference]) });
    assert.throws(() => assessAudit(input), /unknown audit dependency/);
  }
});

test("preserves legitimate cycles that resolve to a reviewed origin", () => {
  const input = report({
    first: vulnerability("first", "high", ["second", "zod"]),
    second: vulnerability("second", "high", ["first"]),
    zod: vulnerability("zod"),
  });
  assert.deepEqual(assessAudit(input).backportedHighPackages, ["first", "second", "zod"]);
});

test("still blocks high cycles without a reviewed origin", () => {
  const input = report({
    first: vulnerability("first", "high", ["second"]),
    second: vulnerability("second", "high", ["first"]),
  });
  assert.throws(() => assessAudit(input), /Unexplained high vulnerability/);
});
