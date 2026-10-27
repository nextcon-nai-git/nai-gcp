import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import extract from "extract-zip";
import { genkit } from "genkit";
import { assessAudit } from "../../scripts/security/check-audit.mjs";

const require = createRequire(import.meta.url);
for (const [name, z] of [
  ["v3 CommonJS", require("zod").z],
  ["v3 ESM", (await import("zod")).z],
  ["bundled v4 CommonJS", require("zod/v4").z],
  ["bundled v4 ESM", (await import("zod/v4")).z],
]) {
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
    const result = z
      .set(element)
      .max(1)
      .safeParse(new Set(["a", "b", "c"]));
    assert.equal(result.success, false);
    assert.equal(calls, 0);
    assert.equal(z.array(z.string()).min(2).safeParse(["a"]).success, false);
  });
}

test("fixed bundled v4 mini enforces collection bounds", async () => {
  const z = await import("zod/v4-mini");
  const result = z.array(z.string()).check(z.maxLength(1)).safeParse(Array(100_000).fill(42));
  assert.equal(result.success, false);
  assert.equal(result.error.issues.length, 1);
});

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
  critical.metadata.vulnerabilities.critical = 1;
  assert.throws(() => assessAudit(critical), /Critical/);
});
