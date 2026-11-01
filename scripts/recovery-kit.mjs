#!/usr/bin/env node
/**
 * Offline file recovery kit. No cloud SDK, credentials, network calls or database import.
 * An operator must provide an approved, completed export directory.
 */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FORMAT = "nai-recovery-kit";
const MANIFEST = "recovery-manifest.json";
const PAYLOAD = "payload";
const PROJECT = "studio-8439299034-125c7";
const READ_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const WRITE_FLAGS = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
const SOURCE_KINDS = new Set([
  "firestore-export",
  "document-export",
  "configuration-export",
  "mixed-export",
  "synthetic-test",
]);

export const DEFAULT_LIMITS = Object.freeze({
  maxFiles: 10000,
  maxDirectories: 20000,
  maxFileBytes: 512 * 1024 * 1024,
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
  maxManifestBytes: 8 * 1024 * 1024,
  maxDepth: 32,
  maxPathBytes: 1024,
});

export class RecoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RecoveryError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RecoveryError(code, message);
}

function limitsFor(overrides = {}) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
    fail("INVALID_LIMITS", "Limites locais inválidos.");
  for (const [key, value] of Object.entries(overrides)) {
    if (
      !Object.hasOwn(DEFAULT_LIMITS, key) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > DEFAULT_LIMITS[key]
    )
      fail("INVALID_LIMITS", "Os limites podem ser reduzidos, nunca ampliados nesta versão.");
  }
  return { ...DEFAULT_LIMITS, ...overrides };
}

function hasExactKeys(value, expected) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function normalizeDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))
    fail("INVALID_METADATA", "Informe data UTC válida da exportação concluída.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) fail("INVALID_METADATA", "Data da exportação inválida.");
  const canonical = date.toISOString();
  if (canonical !== value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z"))
    fail("INVALID_METADATA", "Data da exportação inválida.");
  return canonical;
}

function validateSourceMetadata(input, createdAt) {
  if (
    !hasExactKeys(input, ["kind", "projectId", "exportedAt", "scope"]) ||
    !SOURCE_KINDS.has(input.kind) ||
    typeof input.projectId !== "string" ||
    !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(input.projectId) ||
    typeof input.scope !== "string" ||
    input.scope.length < 1 ||
    input.scope.length > 160 ||
    /[\u0000-\u001f\u007f]/u.test(input.scope)
  )
    fail("INVALID_METADATA", "Metadados declarados da exportação inválidos.");
  const exportedAt = normalizeDate(input.exportedAt);
  if (exportedAt > createdAt) fail("INVALID_METADATA", "A exportação não pode estar no futuro.");
  return { ...input, exportedAt };
}

function validateRelativePath(value, limits) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.normalize("NFC") !== value ||
    Buffer.byteLength(value, "utf8") > limits.maxPathBytes ||
    value.startsWith("/") ||
    /[\\:\u0000-\u001f\u007f]/u.test(value)
  )
    fail("UNSAFE_PATH", "O pacote contém um caminho não permitido.");
  const parts = value.split("/");
  if (parts.length > limits.maxDepth) fail("LIMIT_EXCEEDED", "Limite de profundidade excedido.");
  for (const part of parts) {
    if (
      !part ||
      part === "." ||
      part === ".." ||
      part.startsWith(".") ||
      /[. ]$/u.test(part) ||
      Buffer.byteLength(part, "utf8") > 255 ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part)
    )
      fail("UNSAFE_PATH", "O pacote contém um caminho não permitido.");
    if (
      /(?:^|[-_.])(?:credentials?|secrets?|tokens?)(?:[-_.]|$)/iu.test(part) ||
      /service[-_]?account|firebase-adminsdk|nai-esocial-a1/iu.test(part) ||
      /\.(?:pfx|p12|pem|key|jks|keystore)$/iu.test(part)
    )
      fail("CREDENTIAL_PATH_BLOCKED", "Arquivos de credenciais não são aceitos no kit de recuperação.");
  }
  return parts;
}

function checkUniquePaths(values) {
  const seen = new Set();
  for (const value of values) {
    const folded = value.toLocaleLowerCase("en-US");
    if (seen.has(folded)) fail("PATH_COLLISION", "Caminhos duplicados ou ambíguos no pacote.");
    seen.add(folded);
  }
}

async function plainDirectory(input) {
  if (typeof input !== "string" || !input || input.includes("\0"))
    fail("INVALID_ARGUMENT", "Informe um diretório local válido.");
  if (process.platform !== "linux" || typeof process.getuid !== "function")
    fail("UNSUPPORTED_PLATFORM", "Use este utilitário em Linux com identidade local verificável.");
  const absolute = path.resolve(input);
  let current = path.parse(absolute).root;
  const parts = absolute.slice(current.length).split(path.sep).filter(Boolean);
  trustedDirectory(await fs.lstat(current, { bigint: true }));
  for (const part of parts) {
    current = path.join(current, part);
    const stat = await fs.lstat(current, { bigint: true });
    trustedDirectory(stat);
  }
  const stat = await fs.lstat(absolute, { bigint: true });
  trustedDirectory(stat);
  return { absolute, stat };
}

function trustedDirectory(stat) {
  if (stat.isSymbolicLink()) fail("SYMLINK_BLOCKED", "Links simbólicos não são aceitos.");
  if (!stat.isDirectory()) fail("INVALID_DIRECTORY", "O caminho deve ser um diretório local.");
  const uid = BigInt(process.getuid());
  if (stat.uid !== uid && stat.uid !== 0n)
    fail("UNTRUSTED_DIRECTORY", "Use diretórios controlados pelo operador ou pelo sistema.");
  // A trusted sticky directory, such as /tmp, prevents other UIDs replacing our child.
  // It cannot protect against another process of this UID or a privileged administrator.
  if ((stat.mode & 0o022n) !== 0n && (stat.mode & 0o1000n) === 0n)
    fail("UNTRUSTED_DIRECTORY", "Diretórios compartilhados de escrita exigem proteção sticky.");
}

function sameIdentity(a, b) {
  return a.dev === b.dev && a.ino === b.ino;
}

function stableFile(a, b) {
  return (
    sameIdentity(a, b) &&
    a.size === b.size &&
    a.mtimeNs === b.mtimeNs &&
    a.ctimeNs === b.ctimeNs &&
    b.nlink === 1n &&
    b.isFile()
  );
}

function sizeOf(stat) {
  const size = Number(stat.size);
  if (!Number.isSafeInteger(size) || size < 0) fail("LIMIT_EXCEEDED", "Tamanho de arquivo inválido.");
  return size;
}

function within(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

async function scanDirectory(root, limits) {
  const files = [];
  const directories = [];
  let bytes = 0;
  async function walk(relative) {
    const absolute = relative ? path.join(root, ...relative.split("/")) : root;
    const before = await fs.lstat(absolute, { bigint: true });
    trustedDirectory(before);
    const entries = await boundedNames(absolute, limits.maxFiles + limits.maxDirectories);
    for (const name of entries) {
      const itemPath = relative ? relative + "/" + name : name;
      validateRelativePath(itemPath, limits);
      const stat = await fs.lstat(path.join(absolute, name), { bigint: true });
      if (stat.isSymbolicLink()) fail("SYMLINK_BLOCKED", "Links simbólicos não são aceitos.");
      if (stat.isDirectory()) {
        directories.push(itemPath);
        if (directories.length > limits.maxDirectories)
          fail("LIMIT_EXCEEDED", "Limite de diretórios excedido.");
        await walk(itemPath);
      } else if (stat.isFile()) {
        if (stat.nlink !== 1n) fail("HARDLINK_BLOCKED", "Arquivos com links físicos não são aceitos.");
        const size = sizeOf(stat);
        bytes += size;
        if (files.length >= limits.maxFiles || size > limits.maxFileBytes || bytes > limits.maxTotalBytes)
          fail("LIMIT_EXCEEDED", "Limite de arquivos ou bytes excedido.");
        files.push({ path: itemPath, size, stat });
      } else {
        fail("SPECIAL_FILE_BLOCKED", "Apenas diretórios e arquivos comuns são aceitos.");
      }
    }
    const after = await fs.lstat(absolute, { bigint: true });
    trustedDirectory(after);
    if (!sameIdentity(before, after))
      fail("SOURCE_CHANGED", "A estrutura local mudou durante a leitura.");
  }
  await walk("");
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  directories.sort();
  checkUniquePaths([...directories, ...files.map((file) => file.path)]);
  return { files, directories, bytes };
}

async function boundedNames(directory, maximum) {
  const names = [];
  const handle = await fs.opendir(directory);
  for await (const entry of handle) {
    if (names.length >= maximum) fail("LIMIT_EXCEEDED", "Limite de entradas excedido.");
    names.push(entry.name);
  }
  return names.sort();
}

function assertUnchangedInventory(before, after) {
  if (
    before.files.length !== after.files.length ||
    before.bytes !== after.bytes ||
    before.directories.join("\n") !== after.directories.join("\n") ||
    before.files.some((item, index) =>
      item.path !== after.files[index].path || !stableFile(item.stat, after.files[index].stat)
    )
  ) fail("SOURCE_CHANGED", "A exportação ou o pacote mudou durante a operação.");
}

async function readFileChecked(filename, expected, maxBytes, destination) {
  let input;
  let output;
  try {
    input = await fs.open(filename, READ_FLAGS);
    const before = await input.stat({ bigint: true });
    if (
      !before.isFile() ||
      before.nlink !== 1n ||
      !stableFile(expected, before) ||
      sizeOf(before) > maxBytes
    )
      fail("SOURCE_CHANGED", "O arquivo mudou ou não atende aos limites.");
    if (destination) output = await fs.open(destination, WRITE_FLAGS, 0o600);
    const digest = createHash("sha256");
    const buffer = Buffer.alloc(1024 * 1024);
    let bytes = 0;
    for (;;) {
      const { bytesRead } = await input.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      bytes += bytesRead;
      if (bytes > maxBytes || bytes > sizeOf(before))
        fail("SOURCE_CHANGED", "O arquivo mudou durante a leitura.");
      digest.update(buffer.subarray(0, bytesRead));
      if (output) {
        let written = 0;
        while (written < bytesRead) {
          const result = await output.write(buffer, written, bytesRead - written, null);
          if (!result.bytesWritten) fail("IO_FAILED", "Gravação local incompleta.");
          written += result.bytesWritten;
        }
      }
    }
    const after = await input.stat({ bigint: true });
    const currentPath = await fs.lstat(filename, { bigint: true });
    if (!stableFile(before, after) || !stableFile(before, currentPath) || bytes !== sizeOf(before))
      fail("SOURCE_CHANGED", "O arquivo mudou durante a leitura.");
    if (output) await output.sync();
    return { size: bytes, sha256: digest.digest("hex") };
  } finally {
    await output?.close();
    await input?.close();
  }
}

function evidence(operation, manifestSha256, manifest) {
  return {
    operation,
    status: "verified",
    manifestSha256,
    fileCount: manifest.totals.files,
    directoryCount: manifest.totals.directories,
    totalBytes: manifest.totals.bytes,
    integrityVerified: true,
    localFileRecoveryVerified: false,
    sourceSnapshotConsistencyVerified: false,
    offsiteBackupVerified: false,
    databaseRestoreVerified: false,
    cloudCallsPerformed: false,
  };
}

function validateManifest(value, limits) {
  if (
    !hasExactKeys(value, ["format", "formatVersion", "kitId", "createdAt", "source", "directories", "files", "totals"]) ||
    value.format !== FORMAT ||
    value.formatVersion !== 1 ||
    typeof value.kitId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value.kitId) ||
    !Array.isArray(value.directories) ||
    !Array.isArray(value.files) ||
    value.files.length < 1 ||
    value.files.length > limits.maxFiles ||
    value.directories.length > limits.maxDirectories ||
    !hasExactKeys(value.totals, ["files", "directories", "bytes"])
  )
    fail("INVALID_MANIFEST", "Manifesto incompatível ou inválido.");
  const createdAt = normalizeDate(value.createdAt);
  if (createdAt !== value.createdAt) fail("INVALID_MANIFEST", "Data do manifesto não canônica.");
  const source = validateSourceMetadata(value.source, createdAt);
  if (source.exportedAt !== value.source.exportedAt)
    fail("INVALID_MANIFEST", "Data da exportação não canônica.");
  let bytes = 0;
  for (const directory of value.directories) validateRelativePath(directory, limits);
  for (const file of value.files) {
    if (
      !hasExactKeys(file, ["path", "size", "sha256"]) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      file.size > limits.maxFileBytes ||
      typeof file.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(file.sha256)
    )
      fail("INVALID_MANIFEST", "Entrada de arquivo inválida no manifesto.");
    validateRelativePath(file.path, limits);
    bytes += file.size;
    if (bytes > limits.maxTotalBytes) fail("LIMIT_EXCEEDED", "Limite total de bytes excedido.");
  }
  const paths = [...value.directories, ...value.files.map((file) => file.path)];
  checkUniquePaths(paths);
  const directories = new Set(value.directories);
  for (const item of paths) {
    const parent = item.split("/").slice(0, -1).join("/");
    if (parent && !directories.has(parent))
      fail("INVALID_MANIFEST", "Diretório pai ausente no manifesto.");
  }
  if (
    value.totals.files !== value.files.length ||
    value.totals.directories !== value.directories.length ||
    value.totals.bytes !== bytes ||
    [...value.directories].sort().join("\n") !== value.directories.join("\n") ||
    [...value.files.map((file) => file.path)].sort().join("\n") !== value.files.map((file) => file.path).join("\n")
  )
    fail("INVALID_MANIFEST", "Totais ou ordenação do manifesto inconsistentes.");
  return value;
}

async function readManifest(root, expectedHash, limits) {
  if (typeof expectedHash !== "string" || !/^[0-9a-fA-F]{64}$/u.test(expectedHash))
    fail("TRUST_ANCHOR_REQUIRED", "Informe o SHA-256 do manifesto registrado fora do pacote.");
  const entries = await boundedNames(root, 3);
  if (entries.join("\n") !== [PAYLOAD, MANIFEST].sort().join("\n"))
    fail("UNEXPECTED_ENTRY", "O diretório do kit contém entradas inesperadas.");
  const filename = path.join(root, MANIFEST);
  const stat = await fs.lstat(filename, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n)
    fail("UNSAFE_MANIFEST", "Manifesto deve ser um arquivo comum e independente.");
  if (sizeOf(stat) > limits.maxManifestBytes)
    fail("LIMIT_EXCEEDED", "Limite de bytes do manifesto excedido.");
  const handle = await fs.open(filename, READ_FLAGS);
  let bytes;
  try {
    if (!stableFile(stat, await handle.stat({ bigint: true })))
      fail("SOURCE_CHANGED", "O manifesto mudou durante a leitura.");
    bytes = Buffer.alloc(sizeOf(stat));
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, null);
      if (!result.bytesRead) fail("SOURCE_CHANGED", "O manifesto mudou durante a leitura.");
      offset += result.bytesRead;
    }
    if (!stableFile(stat, await handle.stat({ bigint: true })) || !stableFile(stat, await fs.lstat(filename, { bigint: true })))
      fail("SOURCE_CHANGED", "O manifesto mudou durante a leitura.");
  } finally {
    await handle.close();
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (!timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex")))
    fail("MANIFEST_HASH_MISMATCH", "O manifesto diverge da referência externa.");
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("INVALID_MANIFEST", "O manifesto não contém JSON válido.");
  }
  return { manifest: validateManifest(parsed, limits), manifestSha256: hash };
}

async function inspectKit(kitPath, expectedManifestSha256, limits) {
  const { absolute: root } = await plainDirectory(kitPath);
  const { manifest, manifestSha256 } = await readManifest(root, expectedManifestSha256, limits);
  const payload = await plainDirectory(path.join(root, PAYLOAD));
  const inventory = await scanDirectory(payload.absolute, limits);
  if (
    inventory.files.length !== manifest.files.length ||
    inventory.directories.join("\n") !== manifest.directories.join("\n")
  )
    fail("FILE_SET_MISMATCH", "O conjunto de arquivos ou diretórios não confere.");
  for (let index = 0; index < manifest.files.length; index++) {
    const expected = manifest.files[index];
    const current = inventory.files[index];
    if (current.path !== expected.path || current.size !== expected.size)
      fail("FILE_SET_MISMATCH", "Arquivo ausente, extra ou com tamanho divergente.");
    const checked = await readFileChecked(
      path.join(payload.absolute, ...current.path.split("/")),
      current.stat,
      limits.maxFileBytes
    );
    if (checked.sha256 !== expected.sha256)
      fail("FILE_HASH_MISMATCH", "Integridade de um arquivo não confirmada.");
  }
  assertUnchangedInventory(inventory, await scanDirectory(payload.absolute, limits));
  await readManifest(root, expectedManifestSha256, limits);
  return { root, manifest, manifestSha256, inventory, payload: payload.absolute };
}

async function makeDirectories(root, directories) {
  for (const directory of [...directories].sort((a, b) => a.split("/").length - b.split("/").length || (a < b ? -1 : a > b ? 1 : 0)))
    await fs.mkdir(path.join(root, ...directory.split("/")), { mode: 0o700 });
}

function retainedArtifacts(error, workspaceId) {
  const safe = error instanceof RecoveryError
    ? error
    : new RecoveryError("LOCAL_IO_FAILED", "Falha de leitura ou gravação local; confira o acesso às pastas.");
  safe.manualCleanupRequired = true;
  if (workspaceId) safe.workspaceId = workspaceId;
  return safe;
}

export async function createKit({ sourceDirectory, outputDirectory, source, limits: overrides }) {
  const limits = limitsFor(overrides);
  const createdAt = new Date().toISOString();
  const sourceMetadata = validateSourceMetadata(source, createdAt);
  const { absolute: input } = await plainDirectory(sourceDirectory);
  if (input === path.parse(input).root) fail("INVALID_DIRECTORY", "Não use a raiz do sistema como origem.");
  if (typeof outputDirectory !== "string" || !outputDirectory || outputDirectory.includes("\0"))
    fail("INVALID_ARGUMENT", "Informe um destino novo para o kit.");
  const output = path.resolve(outputDirectory);
  await plainDirectory(path.dirname(output));
  if (within(input, output) || within(output, input))
    fail("OVERLAPPING_DIRECTORIES", "Origem e destino devem estar separados.");
  try {
    await fs.lstat(output);
    fail("DESTINATION_EXISTS", "O destino já existe; nenhum arquivo será sobrescrito.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const inventory = await scanDirectory(input, limits);
  if (!inventory.files.length) fail("EMPTY_EXPORT", "A exportação não contém arquivos.");
  await fs.mkdir(output, { mode: 0o700 });
  try {
    const payload = path.join(output, PAYLOAD);
    await fs.mkdir(payload, { mode: 0o700 });
    await makeDirectories(payload, inventory.directories);
    const files = [];
    for (const entry of inventory.files) {
      const result = await readFileChecked(
        path.join(input, ...entry.path.split("/")),
        entry.stat,
        limits.maxFileBytes,
        path.join(payload, ...entry.path.split("/"))
      );
      files.push({ path: entry.path, ...result });
    }
    assertUnchangedInventory(inventory, await scanDirectory(input, limits));
    const manifest = {
      format: FORMAT,
      formatVersion: 1,
      kitId: randomUUID(),
      createdAt,
      source: sourceMetadata,
      directories: inventory.directories,
      files,
      totals: { files: files.length, directories: inventory.directories.length, bytes: inventory.bytes },
    };
    validateManifest(manifest, limits);
    const serialized = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
    if (serialized.length > limits.maxManifestBytes)
      fail("LIMIT_EXCEEDED", "Limite de bytes do manifesto excedido.");
    await fs.writeFile(path.join(output, MANIFEST), serialized, { flag: "wx", mode: 0o600 });
    const manifestSha256 = createHash("sha256").update(serialized).digest("hex");
    await inspectKit(output, manifestSha256, limits);
    return { ...evidence("create", manifestSha256, manifest), status: "created-and-verified" };
  } catch (error) {
    // Path-based lstat -> rm is not atomic: never risk deleting an operator directory.
    // A partial kit is retained for a controlled, manual inspection and cleanup.
    throw retainedArtifacts(error);
  }
}

export async function verifyKit({ kitDirectory, expectedManifestSha256, limits: overrides }) {
  const checked = await inspectKit(kitDirectory, expectedManifestSha256, limitsFor(overrides));
  return evidence("verify", checked.manifestSha256, checked.manifest);
}

export async function drillKit({ kitDirectory, expectedManifestSha256, limits: overrides }) {
  const limits = limitsFor(overrides);
  const checked = await inspectKit(kitDirectory, expectedManifestSha256, limits);
  const scratch = await plainDirectory(os.tmpdir());
  const temporary = await fs.mkdtemp(path.join(scratch.absolute, "nai-recovery-drill-"));
  const workspaceId = path.basename(temporary);
  try {
    const workspace = await plainDirectory(temporary);
    if ((workspace.stat.mode & 0o077n) !== 0n)
      fail("INSECURE_WORKSPACE", "A área de trabalho precisa ser privada para o operador.");
    await makeDirectories(temporary, checked.manifest.directories);
    for (let index = 0; index < checked.inventory.files.length; index++) {
      const item = checked.inventory.files[index];
      const restored = await readFileChecked(
        path.join(checked.payload, ...item.path.split("/")),
        item.stat,
        limits.maxFileBytes,
        path.join(temporary, ...item.path.split("/"))
      );
      if (restored.sha256 !== checked.manifest.files[index].sha256)
        fail("RECOVERY_HASH_MISMATCH", "A cópia recuperada não confere com o manifesto.");
    }
    const restoredInventory = await scanDirectory(temporary, limits);
    if (
      restoredInventory.files.length !== checked.manifest.files.length ||
      restoredInventory.directories.join("\n") !== checked.manifest.directories.join("\n")
    )
      fail("RECOVERY_SET_MISMATCH", "A estrutura recuperada não confere.");
    for (let index = 0; index < restoredInventory.files.length; index++) {
      const item = restoredInventory.files[index];
      const expected = checked.manifest.files[index];
      const result = await readFileChecked(
        path.join(temporary, ...item.path.split("/")),
        item.stat,
        limits.maxFileBytes
      );
      if (item.path !== expected.path || result.size !== expected.size || result.sha256 !== expected.sha256)
        fail("RECOVERY_HASH_MISMATCH", "A cópia recuperada não confere com o manifesto.");
    }
  } catch (error) {
    throw retainedArtifacts(error, workspaceId);
  }
  return {
    ...evidence("drill", checked.manifestSha256, checked.manifest),
    localFileRecoveryVerified: true,
    temporaryFilesRemoved: false,
    manualCleanupRequired: true,
    workspaceId,
  };
}

export function parseArguments(args) {
  if (!args.length || (args.length === 1 && args[0] === "--help")) return { operation: "help" };
  const [operation, ...remaining] = args;
  const allowed = operation === "create"
    ? new Set(["--source", "--out", "--kind", "--project", "--exported-at", "--scope"])
    : new Set(["--kit", "--expected-manifest-sha256"]);
  if (!["create", "verify", "drill"].includes(operation) || remaining.length % 2)
    fail("INVALID_ARGUMENT", "Comando inválido; consulte --help.");
  const flags = {};
  for (let index = 0; index < remaining.length; index += 2) {
    const key = remaining[index];
    const value = remaining[index + 1];
    if (!allowed.has(key) || Object.hasOwn(flags, key) || !value || value.startsWith("--"))
      fail("INVALID_ARGUMENT", "Argumentos inválidos ou repetidos; consulte --help.");
    flags[key] = value;
  }
  const required = operation === "create"
    ? ["--source", "--out", "--kind", "--exported-at", "--scope"]
    : ["--kit", "--expected-manifest-sha256"];
  if (required.some((key) => !flags[key])) fail("INVALID_ARGUMENT", "Argumentos obrigatórios ausentes.");
  return { operation, flags };
}

const HELP = [
  "NAI — kit local de recuperação de arquivos (não restaura banco ou produção)",
  "",
  "create --source PASTA_EXPORTADA --out DESTINO_NOVO --kind TIPO",
  "       --exported-at DATA_UTC --scope ROTULO [--project ID]",
  "verify --kit PASTA_KIT --expected-manifest-sha256 HASH_EXTERNO",
  "drill  --kit PASTA_KIT --expected-manifest-sha256 HASH_EXTERNO",
  "",
  "TIPO: firestore-export, document-export, configuration-export, mixed-export, synthetic-test.",
  "Use apenas uma exportação concluída, autorizada e sob controle do operador.",
  "Guarde o hash retornado fora do pacote. O drill mantém uma cópia privada para limpeza manual.",
  "O utilitário não apaga pastas; requer Linux e diretórios ancestrais confiáveis.",
  "Não acessa cofres, APIs de nuvem ou banco. Recusa caminhos de credenciais reconhecidos.",
  "Limites: 10000 arquivos; 20000 diretórios; 512 MiB/arquivo; 2 GiB totais; manifesto 8 MiB.",
].join("\n");

export async function main(args, output = process.stdout, errors = process.stderr) {
  try {
    const parsed = parseArguments(args);
    if (parsed.operation === "help") {
      output.write(HELP + "\n");
      return 0;
    }
    const flags = parsed.flags;
    const result = parsed.operation === "create"
      ? await createKit({
          sourceDirectory: flags["--source"],
          outputDirectory: flags["--out"],
          source: {
            kind: flags["--kind"],
            projectId: flags["--project"] || PROJECT,
            exportedAt: flags["--exported-at"],
            scope: flags["--scope"],
          },
        })
      : await (parsed.operation === "verify" ? verifyKit : drillKit)({
          kitDirectory: flags["--kit"],
          expectedManifestSha256: flags["--expected-manifest-sha256"],
        });
    output.write(JSON.stringify(result, null, 2) + "\n");
    return 0;
  } catch (error) {
    const safe = error instanceof RecoveryError
      ? {
          code: error.code,
          message: error.message,
          ...(error.manualCleanupRequired ? { manualCleanupRequired: true } : {}),
          ...(error.workspaceId ? { workspaceId: error.workspaceId } : {}),
        }
      : { code: "LOCAL_IO_FAILED", message: "Falha de leitura ou gravação local; confira o acesso às pastas." };
    errors.write(JSON.stringify({ status: "failed", ...safe, cloudCallsPerformed: false }) + "\n");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.exitCode = await main(process.argv.slice(2));

