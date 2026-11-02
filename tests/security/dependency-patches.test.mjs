import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir, access, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import JSZip from "jszip";
import extract from "extract-zip";
import { genkit, z as genkitZod } from "genkit";
import { assessAudit } from "../../scripts/security/check-audit.mjs";
import { applyDependencyPatches } from "../../scripts/security/apply-dependency-patches.mjs";

const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(
  await readFile(new URL("../../scripts/security/dependency-patches.json", import.meta.url), "utf8")
);
const implementations = [
  ["root v4 CommonJS", require("zod").z],
  ["root v4 ESM", (await import("zod")).z],
  ["application v3 CommonJS", require("zod/v3").z],
  ["application v3 ESM", (await import("zod/v3")).z],
  ["explicit v4 CommonJS", require("zod/v4").z],
  ["explicit v4 ESM", (await import("zod/v4")).z],
  ["Genkit exported schema identity", genkitZod],
];
const miniImplementations = [["root v4 mini", await import("zod/v4-mini")]];
for (const entry of manifest.packages.filter(
  (entry) => entry.name === "zod" && entry.version.startsWith("3.")
)) {
  const base = path.join(projectRoot, entry.path);
  implementations.push(
    [`${entry.path} v3 CommonJS`, require(base).z],
    [`${entry.path} v3 ESM`, (await import(pathToFileURL(path.join(base, "index.js")))).z],
    [`${entry.path} bundled v4 CommonJS`, require(path.join(base, "v4/index.cjs")).z],
    [
      `${entry.path} bundled v4 ESM`,
      (await import(pathToFileURL(path.join(base, "v4/index.js")))).z,
    ]
  );
  miniImplementations.push([
    `${entry.path} bundled v4 mini`,
    await import(pathToFileURL(path.join(base, "v4-mini/index.js"))),
  ]);
}
for (const [name, z] of implementations) {
  test(`${name}: oversized collections fail before validating elements`, async () => {
    let calls = 0;
    const element = z.string().refine(() => {
      calls++;
      return true;
    });
    const oversized = Array(100_000).fill("untrusted");
    for (const schema of [z.array(element).max(2), z.array(element).length(2)]) {
      const sync = schema.safeParse(oversized);
      const asyncResult = await schema.safeParseAsync(oversized);
      assert.equal(sync.success, false);
      assert.equal(asyncResult.success, false);
      assert.equal(sync.error.issues.length, 1);
      assert.equal(sync.error.issues[0].code, "too_big");
      assert.equal(calls, 0);
      assert.deepEqual(schema.parse(["a", "b"]), ["a", "b"]);
      calls = 0;
    }
    const setSchema = z.set(element).max(1);
    const oversizedSet = new Set(["a", "b", "c"]);
    for (const result of [
      setSchema.safeParse(oversizedSet),
      await setSchema.safeParseAsync(oversizedSet),
    ]) {
      assert.equal(result.success, false);
      assert.equal(result.error.issues.length, 1);
      assert.equal(result.error.issues[0].code, "too_big");
    }
    assert.equal(calls, 0);
    assert.equal(z.array(z.string()).min(2).safeParse(["a"]).success, false);
  });
}

for (const [name, z] of miniImplementations) {
  test(`${name} enforces collection bounds`, () => {
    const result = z.array(z.string()).check(z.maxLength(1)).safeParse(Array(100_000).fill(42));
    assert.equal(result.success, false);
    assert.equal(result.error.issues.length, 1);
  });
}

test("Genkit still converts schemas and executes typed flows without model requests", async () => {
  const { z } = await import("genkit");
  const ai = genkit({ plugins: [] });
  const flow = ai.defineFlow(
    {
      name: "securityPatchCompatibility",
      inputSchema: z.object({ items: z.array(z.string()).max(2) }),
      outputSchema: z.string(),
    },
    async ({ items }) => items.join(",")
  );
  assert.equal(await flow({ items: ["a", "b"] }), "a,b");
  await assert.rejects(flow({ items: ["a", "b", "c"] }));
});

// Work on isolated package copies: negative tests must never modify the installed
// dependencies used concurrently by application tests or a development server.
async function dependencyFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nai-dependency-security-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const entry of manifest.packages.filter((entry) => !entry.optional)) {
    const target = path.join(root, entry.path);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(projectRoot, entry.path), target, { recursive: true });
  }
  return root;
}

function zodAudit(nodes) {
  return {
    auditReportVersion: 2,
    metadata: { vulnerabilities: { critical: 0, high: 1 } },
    vulnerabilities: {
      zod: {
        name: "zod",
        severity: "high",
        nodes,
        via: [
          {
            name: "zod",
            severity: "high",
            url: "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5",
          },
        ],
      },
    },
  };
}

test("production-only installs verify required copies without trusting missing optional copies", async (t) => {
  const root = await dependencyFixture(t);
  const verified = applyDependencyPatches({ root, check: true });
  const required = manifest.packages.filter((entry) => entry.name === "zod" && !entry.optional);
  assert.deepEqual(
    [...verified.get("zod")],
    required.map((entry) => entry.path)
  );
  assert.deepEqual(
    assessAudit(zodAudit(required.map((entry) => entry.path)), { root }).backportedHighPackages,
    ["zod"]
  );
  const missing = manifest.packages.find((entry) => entry.name === "zod" && entry.optional);
  assert.throws(
    () => assessAudit(zodAudit([missing.path]), { root }),
    /Unverified dependency installation/
  );
  await rm(path.join(root, required[1].path), { recursive: true });
  assert.throws(() => applyDependencyPatches({ root, check: true }), /ENOENT/);
});

test("new nested copies and aliases fail closed even when no audit node mentions them", async (t) => {
  const root = await dependencyFixture(t);
  for (const location of [
    "node_modules/new-consumer/node_modules/zod",
    "node_modules/@new/consumer/node_modules/zod",
    "node_modules/renamed-zod",
  ]) {
    const base = path.join(root, location);
    await mkdir(base, { recursive: true });
    await writeFile(
      path.join(base, "package.json"),
      JSON.stringify({ name: "zod", version: "3.25.76" })
    );
    for (const check of [false, true]) {
      assert.throws(() => applyDependencyPatches({ root, check }), /Unreviewed Zod installation/);
    }
    assert.throws(
      () => assessAudit(zodAudit(["node_modules/zod"]), { root }),
      /Unreviewed Zod installation/
    );
    await rm(base, { recursive: true });
  }
  assert.doesNotThrow(() => applyDependencyPatches({ root, check: true }));
});

test("every reviewed production path requires the exact package version and patched bytes", async (t) => {
  const root = await dependencyFixture(t);
  for (const entry of manifest.packages.filter((entry) => !entry.optional)) {
    const base = path.join(root, entry.path);
    const metadataPath = path.join(base, "package.json");
    const metadataBytes = await readFile(metadataPath, "utf8");
    for (const changed of [
      { ...JSON.parse(metadataBytes), version: "99.0.0" },
      { ...JSON.parse(metadataBytes), name: "unexpected-package" },
    ]) {
      await writeFile(metadataPath, JSON.stringify(changed));
      for (const check of [false, true]) {
        assert.throws(
          () => applyDependencyPatches({ root, check }),
          /changed .* version or package/
        );
      }
    }
    await writeFile(metadataPath, metadataBytes);
    for (const patch of entry.files) {
      const file = path.join(base, patch.file);
      const bytes = await readFile(file);
      await writeFile(file, Buffer.concat([bytes, Buffer.from("\n// unexpected modification\n")]));
      for (const check of [false, true]) {
        assert.throws(
          () => applyDependencyPatches({ root, check }),
          /Missing or unexpected security patch/
        );
      }
      assert.throws(
        () => assessAudit(zodAudit([entry.path]), { root }),
        /Missing or unexpected security patch/
      );
      await writeFile(file, bytes);
    }
  }
});

test("original reviewed v3 bytes are patched idempotently and check mode never repairs them", async (t) => {
  const root = await dependencyFixture(t);
  const originals = [];
  for (const entry of manifest.packages.filter((entry) => !entry.optional)) {
    for (const patch of entry.files) {
      const file = path.join(root, entry.path, patch.file);
      const patched = await readFile(file, "utf8");
      let original = patched;
      for (const { before, after } of [...patch.changes].reverse()) {
        assert.equal(original.split(after).length, 2);
        original = original.replace(after, before);
      }
      assert.equal(createHash("sha256").update(original).digest("hex"), patch.beforeSha256);
      await writeFile(file, original);
      originals.push({ file, original, patched });
    }
  }
  assert.throws(
    () => applyDependencyPatches({ root, check: true }),
    /Missing or unexpected security patch/
  );
  for (const { file, original } of originals) assert.equal(await readFile(file, "utf8"), original);
  applyDependencyPatches({ root });
  applyDependencyPatches({ root });
  applyDependencyPatches({ root, check: true });
  for (const { file, patched } of originals) assert.equal(await readFile(file, "utf8"), patched);
});

test("upstream source and copied trees reject unexpected files instead of overwriting them", async (t) => {
  const root = await dependencyFixture(t);
  for (const entry of manifest.packages.filter((entry) => !entry.optional)) {
    for (const tree of entry.trees) {
      const extra = path.join(root, entry.path, tree.directory, "unexpected-security-test.js");
      await writeFile(extra, "throw new Error('unexpected code');\n");
      for (const check of [false, true]) {
        assert.throws(
          () => applyDependencyPatches({ root, check }),
          /Missing or unexpected upstream security tree/
        );
      }
      assert.equal(await readFile(extra, "utf8"), "throw new Error('unexpected code');\n");
      await rm(extra);
    }
  }
});

test("a later invalid copy prevents changes to an earlier pristine file", async (t) => {
  const root = await dependencyFixture(t);
  const [first, later] = manifest.packages.filter((entry) => !entry.optional);
  const patch = first.files[0];
  const file = path.join(root, first.path, patch.file);
  let original = await readFile(file, "utf8");
  for (const { before, after } of [...patch.changes].reverse())
    original = original.replace(after, before);
  await writeFile(file, original);
  const invalid = path.join(root, later.path, later.files[0].file);
  await writeFile(invalid, "unreviewed bytes");
  assert.throws(() => applyDependencyPatches({ root }), /Missing or unexpected security patch/);
  assert.equal(await readFile(file, "utf8"), original);
});

test("linked patch files are rejected even when the linked bytes match", async (t) => {
  const root = await dependencyFixture(t);
  const entry = manifest.packages.find((entry) => !entry.optional);
  const file = path.join(root, entry.path, entry.files[0].file);
  await rm(file);
  await symlink(path.join(projectRoot, entry.path, entry.files[0].file), file);
  assert.throws(
    () => applyDependencyPatches({ root, check: true }),
    /Unexpected linked dependency security path/
  );
});

async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nai-archive-security-"));
  const dest = path.join(root, "extracted");
  const outside = path.join(root, "outside");
  await mkdir(dest);
  await mkdir(outside);
  try {
    await fn({ root, dest, outside });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
async function zipFile(root, entries) {
  const zip = new JSZip();
  for (const [name, value, options] of entries) zip.file(name, value, options);
  const file = path.join(root, "input.zip");
  await writeFile(file, await zip.generateAsync({ type: "nodebuffer", platform: "UNIX" }));
  return file;
}

test("ZIP rejects archive symlinks and cannot write outside its directory", async () =>
  fixture(async ({ root, dest, outside }) => {
    const file = await zipFile(root, [
      ["escape", "../outside", { unixPermissions: 0o120777 }],
      ["escape/payload.txt", "attack"],
    ]);
    await assert.rejects(extract(file, { dir: dest }), /symlink/);
    await assert.rejects(access(path.join(outside, "payload.txt")));
  }));

test("ZIP rejects existing leaf symlinks without truncating their targets", async () =>
  fixture(async ({ root, dest, outside }) => {
    const target = path.join(outside, "sentinel.txt");
    await writeFile(target, "unchanged");
    await symlink(target, path.join(dest, "payload.txt"));
    const file = await zipFile(root, [["payload.txt", "attack"]]);
    await assert.rejects(extract(file, { dir: dest }), /symlink/);
    assert.equal(await readFile(target, "utf8"), "unchanged");
  }));

test("ZIP rejects existing ancestor symlinks before creating external directories", async () =>
  fixture(async ({ root, dest, outside }) => {
    await symlink(outside, path.join(dest, "escape"));
    const file = await zipFile(root, [
      ["escape/new/payload.txt", "attack", { createFolders: false }],
    ]);
    await assert.rejects(extract(file, { dir: dest }), /symlink/);
    await assert.rejects(access(path.join(outside, "new")));
  }));

test("ZIP continues extracting regular nested files", async () =>
  fixture(async ({ root, dest }) => {
    const file = await zipFile(root, [["sub/file.txt", "valid", { unixPermissions: 0o100644 }]]);
    await extract(file, { dir: dest });
    assert.equal(await readFile(path.join(dest, "sub/file.txt"), "utf8"), "valid");
  }));

test("audit gate permits only reviewed backports and rejects new or nested vulnerabilities", () => {
  const report = {
    auditReportVersion: 2,
    metadata: { vulnerabilities: { critical: 0, high: 1 } },
    vulnerabilities: {
      zod: {
        name: "zod",
        severity: "high",
        nodes: ["node_modules/zod"],
        via: [
          {
            name: "zod",
            severity: "high",
            url: "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5",
          },
        ],
      },
    },
  };
  assert.deepEqual(assessAudit(report).backportedHighPackages, ["zod"]);
  const unknown = structuredClone(report);
  unknown.vulnerabilities.zod.via[0].url = "https://github.com/advisories/GHSA-new-advisory";
  assert.throws(() => assessAudit(unknown), /Unpatched vulnerability/);
  const nested = structuredClone(report);
  nested.vulnerabilities.zod.nodes.push("node_modules/other/node_modules/zod");
  assert.throws(() => assessAudit(nested), /Unpatched nested/);
  assert.throws(() => assessAudit({ error: { code: "ENETUNREACH" } }), /Invalid/);
  const critical = structuredClone(report);
  critical.metadata.vulnerabilities.high = 0;
  critical.metadata.vulnerabilities.critical = 1;
  critical.vulnerabilities.zod.severity = "critical";
  critical.vulnerabilities.zod.via[0].severity = "critical";
  assert.throws(() => assessAudit(critical), /Critical/);
});
