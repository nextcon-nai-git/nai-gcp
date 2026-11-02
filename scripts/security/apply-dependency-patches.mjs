import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const check = process.argv.includes("--check");
const digest = (data) => createHash("sha256").update(data).digest("hex");
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const patches = json(new URL("./dependency-patches.json", import.meta.url));
for (const patch of patches) {
  const base = path.join(root, "node_modules", patch.package);
  if (patch.optional && !existsSync(base)) continue;
  if (json(path.join(base, "package.json")).version !== patch.version)
    throw new Error(`Review security backport for changed ${patch.package} version`);
  const file = path.join(base, patch.file);
  let source = readFileSync(file, "utf8");
  if (digest(source) === patch.afterSha256) continue;
  if (check || digest(source) !== patch.beforeSha256)
    throw new Error(`Missing or unexpected security patch: ${patch.package}/${patch.file}`);
  for (const { before, after } of patch.changes) {
    if (source.split(before).length !== 2) throw new Error(`Ambiguous patch: ${file}`);
    source = source.replace(before, after);
  }
  if (digest(source) !== patch.afterSha256) throw new Error(`Invalid patch result: ${file}`);
  writeFileSync(file, source);
}

// Zod 3 also ships a v4 entry point. Use the official fixed v4 implementation,
// rather than leaving that alternate import vulnerable behind the v3 backport.
const fixedZod = path.join(root, "node_modules/zod-security-v4");
if (json(path.join(fixedZod, "package.json")).version !== "4.6.7")
  throw new Error("Review the upstream Zod v4 security source before changing its version");
function treeDigest(directory) {
  const hash = createHash("sha256");
  function walk(relative) {
    for (const item of readdirSync(path.join(directory, relative), { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name)
    )) {
      const name = path.join(relative, item.name);
      if (item.isDirectory()) walk(name);
      else {
        hash.update(name);
        hash.update(readFileSync(path.join(directory, name)));
      }
    }
  }
  walk("");
  return hash.digest("hex");
}
for (const dir of ["v4", "src/v4"]) {
  const source = path.join(fixedZod, dir);
  const target = path.join(root, "node_modules/zod", dir);
  if (treeDigest(source) === treeDigest(target)) continue;
  if (check) throw new Error(`Missing upstream Zod patch: ${dir}`);
  rmSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}
console.log(
  check ? "Dependency security backports verified." : "Dependency security backports applied."
);
