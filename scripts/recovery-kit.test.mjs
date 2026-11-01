import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fsMutable, * as fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { createKit, verifyKit, drillKit, parseArguments, main } from "./recovery-kit.mjs";

const sourceMetadata = {
  kind: "synthetic-test",
  projectId: "demo-nai-recovery",
  exportedAt: "2020-01-01T00:00:00.000Z",
  scope: "synthetic-fixture-only",
};

async function fixture(t, files = { "record.json": '{"synthetic":true}\n' }, directories = []) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nai-recovery-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sourceDirectory = path.join(root, "source");
  const outputDirectory = path.join(root, "kit");
  await fs.mkdir(sourceDirectory);
  for (const directory of directories)
    await fs.mkdir(path.join(sourceDirectory, directory), { recursive: true });
  for (const [name, value] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(sourceDirectory, name)), { recursive: true });
    await fs.writeFile(path.join(sourceDirectory, name), value);
  }
  return { root, sourceDirectory, outputDirectory, source: { ...sourceMetadata } };
}

async function kit(t, files, directories) {
  const input = await fixture(t, files, directories);
  const result = await createKit(input);
  return {
    ...input,
    result,
    kitDirectory: input.outputDirectory,
    expectedManifestSha256: result.manifestSha256,
  };
}

async function rewriteManifest(input, mutate) {
  const filename = path.join(input.kitDirectory, "recovery-manifest.json");
  const value = JSON.parse(await fs.readFile(filename, "utf8"));
  mutate(value);
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
  await fs.writeFile(filename, bytes);
  return createHash("sha256").update(bytes).digest("hex");
}

function hasCode(...codes) {
  return (error) => codes.includes(error?.code);
}

async function withFilesystemHooks(hooks, execute) {
  const originals = new Map(Object.keys(hooks).map((name) => [name, fsMutable[name]]));
  try {
    for (const [name, hook] of Object.entries(hooks)) fsMutable[name] = hook;
    syncBuiltinESMExports();
    return await execute();
  } finally {
    for (const [name, original] of originals) fsMutable[name] = original;
    syncBuiltinESMExports();
  }
}

test("create and verify preserve binary bytes, nested files and empty directories", async (t) => {
  const binary = Buffer.from([0, 1, 127, 128, 255, 10, 0]);
  const input = await kit(
    t,
    {
      "documents/Pessoa Simulada.pdf": binary,
      "firestore/ALL_NAMESPACES_KIND_clients.export_metadata": "synthetic-metadata",
      "firestore/output-0": "synthetic-shard",
    },
    ["empty"]
  );
  const result = await verifyKit(input);
  assert.equal(result.fileCount, 3);
  assert.equal(result.directoryCount, 3);
  assert.equal(result.integrityVerified, true);
  assert.equal(result.offsiteBackupVerified, false);
  assert.equal(result.databaseRestoreVerified, false);
  assert.equal(result.cloudCallsPerformed, false);
  assert.equal(result.sourceSnapshotConsistencyVerified, false);
  assert.deepEqual(
    await fs.readFile(path.join(input.kitDirectory, "payload/documents/Pessoa Simulada.pdf")),
    binary
  );
  const manifest = JSON.parse(
    await fs.readFile(path.join(input.kitDirectory, "recovery-manifest.json"), "utf8")
  );
  assert.equal(manifest.source.exportedAt, sourceMetadata.exportedAt);
  assert.equal(manifest.source.kind, "synthetic-test");
  assert.equal(manifest.totals.files, 3);
});

test("kit files and directories restrict access to the local owner", async (t) => {
  const input = await kit(t);
  for (const item of [input.kitDirectory, path.join(input.kitDirectory, "payload")])
    assert.equal((await fs.stat(item)).mode & 0o077, 0);
  for (const item of ["recovery-manifest.json", "payload/record.json"])
    assert.equal((await fs.stat(path.join(input.kitDirectory, item))).mode & 0o077, 0);
});

test("the isolated drill verifies copied bytes and explicitly retains its private workspace", async (t) => {
  const input = await kit(t, { "synthetic-person.json": '{"notReal":true}' });
  t.mock.method(os, "tmpdir", () => input.root);
  const result = await drillKit(input);
  assert.equal(result.localFileRecoveryVerified, true);
  assert.equal(result.temporaryFilesRemoved, false);
  assert.equal(result.manualCleanupRequired, true);
  assert.match(result.workspaceId, /^nai-recovery-drill-[a-zA-Z0-9]+$/u);
  const workspace = path.join(input.root, result.workspaceId);
  assert.equal((await fs.stat(workspace)).mode & 0o077, 0);
  assert.equal(
    await fs.readFile(path.join(workspace, "synthetic-person.json"), "utf8"),
    '{"notReal":true}'
  );
  assert.equal(result.databaseRestoreVerified, false);
  assert.equal(result.offsiteBackupVerified, false);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-person|notReal|\/tmp\//u);
  assert.equal((await verifyKit(input)).integrityVerified, true);
});

test("an existing output directory is preserved without overwriting", async (t) => {
  const input = await fixture(t);
  await fs.mkdir(input.outputDirectory);
  const marker = path.join(input.outputDirectory, "operator-owned.txt");
  await fs.writeFile(marker, "keep");
  await assert.rejects(createKit(input), hasCode("DESTINATION_EXISTS"));
  assert.equal(await fs.readFile(marker, "utf8"), "keep");
  assert.deepEqual(await fs.readdir(input.outputDirectory), ["operator-owned.txt"]);
});

test("destination inside the source is refused", async (t) => {
  const input = await fixture(t);
  input.outputDirectory = path.join(input.sourceDirectory, "kit");
  await assert.rejects(createKit(input), hasCode("OVERLAPPING_DIRECTORIES"));
  assert.deepEqual(await fs.readdir(input.sourceDirectory), ["record.json"]);
});

test("empty exports are never reported as a successful backup", async (t) => {
  const input = await fixture(t, {}, ["empty"]);
  await assert.rejects(createKit(input), hasCode("EMPTY_EXPORT"));
  await assert.rejects(fs.stat(input.outputDirectory), hasCode("ENOENT"));
});

test("known credential paths and hidden files are refused before a package is created", async (t) => {
  for (const name of [
    ".env",
    "credentials.json",
    "service-account.json",
    "certificate.pfx",
    "certificate.p12",
    "secrets/material.json",
  ]) {
    const input = await fixture(t, { [name]: "synthetic-do-not-process" });
    await assert.rejects(createKit(input), hasCode("CREDENTIAL_PATH_BLOCKED", "UNSAFE_PATH"));
    await assert.rejects(fs.stat(input.outputDirectory), hasCode("ENOENT"));
  }
});

test("source file symlinks are refused", async (t) => {
  const input = await fixture(t, {});
  const outside = path.join(input.root, "outside.txt");
  await fs.writeFile(outside, "unchanged");
  await fs.symlink(outside, path.join(input.sourceDirectory, "linked.txt"));
  await assert.rejects(createKit(input), hasCode("SYMLINK_BLOCKED"));
  assert.equal(await fs.readFile(outside, "utf8"), "unchanged");
  await assert.rejects(fs.stat(input.outputDirectory), hasCode("ENOENT"));
});

test("symlinked source directories and destination parents are refused", async (t) => {
  const input = await fixture(t);
  const alias = path.join(input.root, "alias");
  await fs.symlink(input.sourceDirectory, alias, "dir");
  await assert.rejects(createKit({ ...input, sourceDirectory: alias }), hasCode("SYMLINK_BLOCKED"));
  const outputAlias = path.join(input.root, "output-alias");
  await fs.symlink(input.root, outputAlias, "dir");
  await assert.rejects(
    createKit({ ...input, outputDirectory: path.join(outputAlias, "new") }),
    hasCode("SYMLINK_BLOCKED")
  );
});

test("hardlinked source files are refused", async (t) => {
  const input = await fixture(t);
  await fs.link(
    path.join(input.sourceDirectory, "record.json"),
    path.join(input.root, "outside-hardlink")
  );
  await assert.rejects(createKit(input), hasCode("HARDLINK_BLOCKED"));
});

test("case-insensitive file collisions are refused", async (t) => {
  const input = await fixture(t, { "Record.json": "one", "record.json": "two" });
  await assert.rejects(createKit(input), hasCode("PATH_COLLISION"));
});

test("non-canonical Unicode and unsafe path components are refused", async (t) => {
  for (const name of ["e\u0301.json", "bad\\name.json", "name.", "NUL.json"]) {
    const input = await fixture(t, { [name]: "synthetic" });
    await assert.rejects(createKit(input), hasCode("UNSAFE_PATH"));
  }
});

test("file count, total bytes, per-file bytes and directory depth are bounded", async (t) => {
  const input = await fixture(t, { first: "12", second: "34" });
  await assert.rejects(createKit({ ...input, limits: { maxFiles: 1 } }), hasCode("LIMIT_EXCEEDED"));
  await assert.rejects(
    createKit({ ...input, limits: { maxTotalBytes: 3 } }),
    hasCode("LIMIT_EXCEEDED")
  );
  await assert.rejects(
    createKit({ ...input, limits: { maxFileBytes: 1 } }),
    hasCode("LIMIT_EXCEEDED")
  );
  const nested = await fixture(t, { "one/two": "x" });
  await assert.rejects(
    createKit({ ...nested, limits: { maxDepth: 1 } }),
    hasCode("LIMIT_EXCEEDED")
  );
});

test("limits cannot be expanded or disabled by API options", async (t) => {
  const input = await fixture(t);
  for (const limits of [
    { maxFiles: 10001 },
    { maxFiles: 0 },
    { maxFiles: Infinity },
    { unknown: 1 },
  ])
    await assert.rejects(createKit({ ...input, limits }), hasCode("INVALID_LIMITS"));
});

test("failed package creation retains its partial directory and requests manual inspection", async (t) => {
  const input = await fixture(t);
  const before = await fs.readFile(path.join(input.sourceDirectory, "record.json"));
  await assert.rejects(createKit({ ...input, limits: { maxManifestBytes: 1 } }), (error) => {
    assert.equal(error.code, "LIMIT_EXCEEDED");
    assert.equal(error.manualCleanupRequired, true);
    return true;
  });
  assert.equal((await fs.stat(input.outputDirectory)).isDirectory(), true);
  assert.deepEqual(
    await fs.readFile(path.join(input.outputDirectory, "payload/record.json")),
    before
  );
  assert.deepEqual(await fs.readFile(path.join(input.sourceDirectory, "record.json")), before);
});

test("a directory substituted after mkdir is never automatically deleted", async (t) => {
  const input = await fixture(t);
  const parked = path.join(input.root, "original-output");
  const unrelated = path.join(input.root, "operator-owned-directory");
  await fs.mkdir(unrelated);
  await fs.writeFile(path.join(unrelated, "keep.txt"), "SYNTHETIC KEEP");
  const originalLstat = fs.lstat;
  let substituted = false;
  await withFilesystemHooks(
    {
      lstat: async (filename, ...args) => {
        if (filename === input.outputDirectory && !substituted) {
          let exists = false;
          try {
            exists = (await originalLstat(filename)).isDirectory();
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }
          if (exists) {
            await fs.rename(input.outputDirectory, parked);
            await fs.rename(unrelated, input.outputDirectory);
            substituted = true;
          }
        }
        return originalLstat(filename, ...args);
      },
    },
    async () => {
      await assert.rejects(createKit(input), (error) => {
        assert.equal(error.code, "UNEXPECTED_ENTRY");
        assert.equal(error.manualCleanupRequired, true);
        return true;
      });
    }
  );
  assert.equal(substituted, true);
  assert.equal(
    await fs.readFile(path.join(input.outputDirectory, "keep.txt"), "utf8"),
    "SYNTHETIC KEEP"
  );
  assert.equal((await fs.stat(parked)).isDirectory(), true);
});

test("the drill cannot delete a substituted operator directory at a cleanup boundary", async (t) => {
  const input = await kit(t);
  t.mock.method(os, "tmpdir", () => input.root);
  const unrelated = path.join(input.root, "operator-owned-directory");
  await fs.mkdir(unrelated);
  await fs.writeFile(path.join(unrelated, "keep.txt"), "SYNTHETIC KEEP");
  const originalRm = fs.rm;
  let removalCalls = 0;
  await withFilesystemHooks(
    {
      rm: async (directory, ...args) => {
        removalCalls++;
        // Reproduce the old lstat -> rm race if recursive cleanup is ever reintroduced.
        await fs.rename(directory, path.join(input.root, "parked-workspace"));
        await fs.rename(unrelated, directory);
        return originalRm(directory, ...args);
      },
    },
    async () => {
      const result = await drillKit(input);
      assert.equal(result.manualCleanupRequired, true);
      assert.equal(result.temporaryFilesRemoved, false);
    }
  );
  assert.equal(removalCalls, 0);
  assert.equal(await fs.readFile(path.join(unrelated, "keep.txt"), "utf8"), "SYNTHETIC KEEP");
});

test("shared writable parents without sticky protection are refused", async (t) => {
  const input = await fixture(t);
  const shared = path.join(input.root, "shared");
  await fs.mkdir(shared);
  await fs.chmod(shared, 0o777);
  await assert.rejects(
    createKit({ ...input, outputDirectory: path.join(shared, "kit") }),
    hasCode("UNTRUSTED_DIRECTORY")
  );
  assert.deepEqual(await fs.readdir(shared), []);
  await fs.chmod(shared, 0o1777);
  const result = await createKit({ ...input, outputDirectory: path.join(shared, "kit") });
  assert.equal(result.integrityVerified, true);
});

test("untrusted ancestors are rejected even when the immediate parent is private", async (t) => {
  const input = await fixture(t);
  const shared = path.join(input.root, "shared");
  const privateParent = path.join(shared, "private");
  await fs.mkdir(privateParent, { recursive: true, mode: 0o700 });
  await fs.chmod(shared, 0o777);
  await assert.rejects(
    createKit({ ...input, outputDirectory: path.join(privateParent, "kit") }),
    hasCode("UNTRUSTED_DIRECTORY")
  );
  assert.deepEqual(await fs.readdir(privateParent), []);
});

test("verification requires an externally recorded hash", async (t) => {
  const input = await kit(t);
  for (const expectedManifestSha256 of [undefined, "", "not-a-hash", "a".repeat(63)])
    await assert.rejects(
      verifyKit({ ...input, expectedManifestSha256 }),
      hasCode("TRUST_ANCHOR_REQUIRED")
    );
  await assert.rejects(
    verifyKit({ ...input, expectedManifestSha256: "0".repeat(64) }),
    hasCode("MANIFEST_HASH_MISMATCH")
  );
});

test("modified manifest is rejected using the original reference", async (t) => {
  const input = await kit(t);
  await rewriteManifest(input, (manifest) => {
    manifest.source.scope = "changed";
  });
  await assert.rejects(verifyKit(input), hasCode("MANIFEST_HASH_MISMATCH"));
});

test("same-size data corruption is detected", async (t) => {
  const input = await kit(t, { "record.txt": "AAAA" });
  await fs.writeFile(path.join(input.kitDirectory, "payload/record.txt"), "BBBB");
  await assert.rejects(verifyKit(input), hasCode("FILE_HASH_MISMATCH"));
  await assert.rejects(drillKit(input), hasCode("FILE_HASH_MISMATCH"));
});

test("missing files and extra files are rejected", async (t) => {
  const missing = await kit(t);
  await fs.unlink(path.join(missing.kitDirectory, "payload/record.json"));
  await assert.rejects(verifyKit(missing), hasCode("FILE_SET_MISMATCH"));
  const extra = await kit(t);
  await fs.writeFile(path.join(extra.kitDirectory, "payload/extra.txt"), "unexpected");
  await assert.rejects(verifyKit(extra), hasCode("FILE_SET_MISMATCH"));
});

test("extra empty directories and extra kit-root entries are rejected", async (t) => {
  const extraDirectory = await kit(t);
  await fs.mkdir(path.join(extraDirectory.kitDirectory, "payload/extra"));
  await assert.rejects(verifyKit(extraDirectory), hasCode("FILE_SET_MISMATCH"));
  const extraRoot = await kit(t);
  await fs.writeFile(path.join(extraRoot.kitDirectory, "extra.txt"), "unexpected");
  await assert.rejects(verifyKit(extraRoot), hasCode("UNEXPECTED_ENTRY"));
});

test("symlinks and hardlinks in stored kits are rejected", async (t) => {
  const input = await kit(t);
  const target = path.join(input.kitDirectory, "payload/record.json");
  const outside = path.join(input.root, "outside.txt");
  await fs.writeFile(outside, "synthetic");
  await fs.unlink(target);
  await fs.symlink(outside, target);
  await assert.rejects(verifyKit(input), hasCode("SYMLINK_BLOCKED"));
  await fs.unlink(target);
  await fs.link(outside, target);
  await assert.rejects(verifyKit(input), hasCode("HARDLINK_BLOCKED"));
});

test("malicious paths fail even when a caller supplies a matching malicious manifest hash", async (t) => {
  for (const unsafe of [
    "../escape",
    "/absolute",
    "dir/../escape",
    "dir\\escape",
    "C:/escape",
    "dir//entry",
    ".env",
  ]) {
    const input = await kit(t);
    const hash = await rewriteManifest(input, (manifest) => {
      manifest.files[0].path = unsafe;
    });
    await assert.rejects(
      drillKit({ ...input, expectedManifestSha256: hash }),
      hasCode("UNSAFE_PATH")
    );
  }
});

test("duplicate paths and missing directory parents fail manifest validation", async (t) => {
  const duplicate = await kit(t);
  const duplicateHash = await rewriteManifest(duplicate, (manifest) => {
    manifest.files.push({ ...manifest.files[0] });
    manifest.totals.files = 2;
    manifest.totals.bytes *= 2;
  });
  await assert.rejects(
    verifyKit({ ...duplicate, expectedManifestSha256: duplicateHash }),
    hasCode("PATH_COLLISION")
  );
  const missingParent = await kit(t);
  const missingHash = await rewriteManifest(missingParent, (manifest) => {
    manifest.files[0].path = "absent/record.json";
  });
  await assert.rejects(
    verifyKit({ ...missingParent, expectedManifestSha256: missingHash }),
    hasCode("INVALID_MANIFEST")
  );
});

test("schema version, unknown fields and inconsistent totals fail closed", async (t) => {
  for (const mutate of [
    (manifest) => {
      manifest.formatVersion = 2;
    },
    (manifest) => {
      manifest.unexpected = true;
    },
    (manifest) => {
      manifest.totals.bytes += 1;
    },
    (manifest) => {
      manifest.files[0].size = -1;
    },
  ]) {
    const input = await kit(t);
    const hash = await rewriteManifest(input, mutate);
    await assert.rejects(
      verifyKit({ ...input, expectedManifestSha256: hash }),
      hasCode("INVALID_MANIFEST")
    );
  }
});

test("oversized manifests are rejected before JSON parsing", async (t) => {
  const input = await kit(t);
  await assert.rejects(
    verifyKit({ ...input, limits: { maxManifestBytes: 1 } }),
    hasCode("LIMIT_EXCEEDED")
  );
});

test("source metadata rejects invalid dates, future dates and missing scope", async (t) => {
  const input = await fixture(t);
  for (const source of [
    { ...sourceMetadata, exportedAt: "2020-02-31T00:00:00.000Z" },
    { ...sourceMetadata, exportedAt: "2099-01-01T00:00:00.000Z" },
    { ...sourceMetadata, scope: "" },
    { ...sourceMetadata, kind: "production-is-restored" },
  ])
    await assert.rejects(createKit({ ...input, source }), hasCode("INVALID_METADATA"));
});

test("CLI refuses target selection for a drill and repeated or unknown flags", () => {
  for (const args of [
    ["restore", "--target", "production"],
    ["drill", "--kit", "x", "--target", "production"],
    ["verify", "--kit", "a", "--kit", "b"],
    ["create", "--source"],
  ])
    assert.throws(() => parseArguments(args), hasCode("INVALID_ARGUMENT"));
});

test("CLI summaries and errors omit paths, filenames and file content", async (t) => {
  const input = await fixture(t, { "PRIVATE_SYNTHETIC_PERSON.txt": "SYNTHETIC_CLINICAL_CONTENT" });
  let stdout = "";
  let stderr = "";
  const out = {
    write: (value) => {
      stdout += value;
    },
  };
  const err = {
    write: (value) => {
      stderr += value;
    },
  };
  const exitCode = await main(
    [
      "create",
      "--source",
      input.sourceDirectory,
      "--out",
      input.outputDirectory,
      "--kind",
      "synthetic-test",
      "--exported-at",
      sourceMetadata.exportedAt,
      "--scope",
      "PRIVATE_SCOPE",
    ],
    out,
    err
  );
  assert.equal(exitCode, 0);
  assert.equal(stderr, "");
  assert.doesNotMatch(
    stdout,
    /PRIVATE_SYNTHETIC_PERSON|SYNTHETIC_CLINICAL_CONTENT|PRIVATE_SCOPE|\/tmp\//u
  );
  stdout = "";
  const failure = await main(
    [
      "verify",
      "--kit",
      path.join(input.root, "MISSING_PRIVATE_PATH"),
      "--expected-manifest-sha256",
      "0".repeat(64),
    ],
    out,
    err
  );
  assert.equal(failure, 1);
  assert.equal(stdout, "");
  assert.doesNotMatch(stderr, /MISSING_PRIVATE_PATH|\/tmp\//u);
  assert.equal(JSON.parse(stderr).cloudCallsPerformed, false);
});
