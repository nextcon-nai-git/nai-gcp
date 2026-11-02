import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const archiveRule = `    match /{path=**}/contracts/{contractId} {
      allow list: if isNextconOfficial();
    }`;
export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// Never substitute the repository's complete rules for the live configuration.
export function prepareContractArchive(active, expectedHash, reference) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || sha256(active) !== expectedHash)
    throw new Error("Active rules differ from the reviewed SHA-256. Review a fresh export.");
  const anchor = "  match /databases/{database}/documents {";
  if (!active.startsWith("rules_version = '2';") || active.split(anchor).length !== 2)
    throw new Error("Unsupported rules structure.");
  // Fail closed if the live role policy differs, rather than silently widening it.
  for (const name of ["isSignedIn", "getUserProfile", "isInternalStaff", "isNextconOfficial"]) {
    const pattern = new RegExp(`    function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}`);
    const live = active.match(pattern)?.[0];
    if (!live || live !== reference.match(pattern)?.[0])
      throw new Error(`Review the published ${name} policy before preparing the patch.`);
  }
  if (/match\s+\/\{\w+=\*\*\}\/contracts\//.test(active))
    throw new Error("A contracts collection-group rule already exists. Inspect it instead.");
  return active.replace(anchor, `${anchor}\n${archiveRule}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, expectedHash, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error(
      "Usage: node scripts/firestore/prepare-contract-archive.mjs ACTIVE.rules EXPECTED_SHA256 OUTPUT.rules"
    );
  const active = readFileSync(input, "utf8");
  const patched = prepareContractArchive(
    active,
    expectedHash,
    readFileSync("firestore.rules", "utf8")
  );
  writeFileSync(output, patched, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ before: sha256(active), after: sha256(patched), output }));
}
