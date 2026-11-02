import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const defaultRoot = fileURLToPath(new URL("../../", import.meta.url));
const digest = (data) => createHash("sha256").update(data).digest("hex");
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const manifest = json(new URL("./dependency-patches.json", import.meta.url));
if (manifest.schemaVersion !== 2 || !Array.isArray(manifest.packages))
  throw new Error("Unsupported dependency security manifest");

export function reviewedDependencyPaths() {
  return manifest.packages.map(({ name, path: location }) => ({ name, path: location }));
}

function child(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    relative.includes("\\") ||
    path.posix.isAbsolute(relative) ||
    relative.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error("Invalid dependency security path");
  return path.join(root, ...relative.split("/"));
}

function unlinked(location) {
  if (realpathSync(location) !== path.resolve(location))
    throw new Error(`Unexpected linked dependency security path: ${location}`);
}

function treeDigest(directory) {
  unlinked(directory);
  const files = [];
  function walk(relative) {
    for (const item of readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${item.name}` : item.name;
      if (item.isDirectory()) walk(name);
      else if (item.isFile()) files.push(name);
      else throw new Error(`Unexpected dependency tree entry: ${name}`);
    }
  }
  walk("");
  const hash = createHash("sha256");
  for (const name of files.sort()) {
    const bytes = readFileSync(child(directory, name));
    hash.update(name).update("\0").update(String(bytes.length)).update("\0").update(bytes);
  }
  return hash.digest("hex");
}

// npm may introduce a new transitive copy or an alias without changing the public
// import. Inspect installed package locations, not only the top-level package.
function installedZodPaths(root) {
  const result = new Set();
  function packageAt(location) {
    const absolute = child(root, location);
    unlinked(absolute);
    const metadata = path.join(absolute, "package.json");
    if (
      path.basename(location) === "zod" ||
      (existsSync(metadata) && json(metadata).name === "zod")
    )
      result.add(location);
    modulesAt(`${location}/node_modules`);
  }
  function modulesAt(location) {
    const absolute = child(root, location);
    if (!existsSync(absolute)) return;
    unlinked(absolute);
    for (const item of readdirSync(absolute, { withFileTypes: true })) {
      if (item.name.startsWith(".")) continue;
      const nested = `${location}/${item.name}`;
      if (item.name.startsWith("@")) {
        unlinked(child(root, nested));
        for (const scoped of readdirSync(child(root, nested), { withFileTypes: true }))
          if (scoped.isDirectory() || scoped.isSymbolicLink())
            packageAt(`${nested}/${scoped.name}`);
      } else if (item.isDirectory() || item.isSymbolicLink()) packageAt(nested);
    }
  }
  modulesAt("node_modules");
  return result;
}

/** Apply only exact-byte reviewed backports, or verify them without writing. */
export function applyDependencyPatches({ root = defaultRoot, check = false } = {}) {
  root = path.resolve(root);
  const reviewedZod = new Set(
    manifest.packages.filter((entry) => entry.name === "zod").map((entry) => entry.path)
  );
  for (const location of installedZodPaths(root))
    if (!reviewedZod.has(location)) throw new Error(`Unreviewed Zod installation: ${location}`);

  const operations = [];
  const verified = new Map();
  for (const entry of manifest.packages) {
    const base = child(root, entry.path);
    if (entry.optional && !existsSync(base)) continue;
    unlinked(base);
    const metadata = json(path.join(base, "package.json"));
    if (metadata.name !== entry.name || metadata.version !== entry.version)
      throw new Error(`Review security backport for changed ${entry.path} version or package`);
    for (const patch of entry.files) {
      const file = child(base, patch.file);
      unlinked(file);
      if (!lstatSync(file).isFile()) throw new Error(`Invalid dependency patch file: ${file}`);
      let source = readFileSync(file, "utf8");
      if (digest(source) === patch.afterSha256) continue;
      if (check || digest(source) !== patch.beforeSha256)
        throw new Error(`Missing or unexpected security patch: ${entry.path}/${patch.file}`);
      for (const { before, after } of patch.changes) {
        if (source.split(before).length !== 2) throw new Error(`Ambiguous patch: ${file}`);
        source = source.replace(before, after);
      }
      if (digest(source) !== patch.afterSha256) throw new Error(`Invalid patch result: ${file}`);
      operations.push(() => writeFileSync(file, source));
    }
    for (const tree of entry.trees) {
      const target = child(base, tree.directory);
      const current = treeDigest(target);
      if (current === tree.sha256) continue;
      if (check || !tree.copyFrom || current !== tree.beforeSha256)
        throw new Error(
          `Missing or unexpected upstream security tree: ${entry.path}/${tree.directory}`
        );
      const source = child(root, tree.copyFrom);
      if (treeDigest(source) !== tree.sha256)
        throw new Error(`Unverified upstream security source: ${tree.copyFrom}`);
      operations.push(() => {
        rmSync(target, { recursive: true });
        cpSync(source, target, { recursive: true });
        if (treeDigest(target) !== tree.sha256)
          throw new Error(`Invalid upstream security copy: ${entry.path}/${tree.directory}`);
      });
    }
    const nodes = verified.get(entry.name) || new Set();
    nodes.add(entry.path);
    verified.set(entry.name, nodes);
  }
  // Validate every copy before changing any file. A new version, hash or location
  // fails closed instead of leaving a partially accepted security policy.
  for (const apply of operations) apply();
  return verified;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  applyDependencyPatches({ check });
  console.log(
    check ? "Dependency security backports verified." : "Dependency security backports applied."
  );
}
