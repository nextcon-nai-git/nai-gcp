import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
const destination = new URL("../functions/audit-s2220/", import.meta.url);
const security = new URL("./security/", import.meta.url);
const builtSecurity = new URL("scripts/security/", destination);
await mkdir(builtSecurity, { recursive: true });
await build({
  entryPoints: [new URL("../src/services/esocial/s2220-audit-access.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  packages: "external",
  outfile: new URL("lib/audit.cjs", destination).pathname,
});
for (const file of ["apply-dependency-patches.mjs", "check-audit.mjs"])
  await copyFile(new URL(file, security), new URL(file, builtSecurity));
const manifest = JSON.parse(await readFile(new URL("dependency-patches.json", security), "utf8"));
// The isolated npm tree can install the same reviewed Zod 3 build for OpenAI's optional peer.
const nested = manifest.packages.find(
  (p) => p.path === "node_modules/@genkit-ai/core/node_modules/zod"
);
manifest.packages.push({
  ...nested,
  path: "node_modules/@genkit-ai/compat-oai/node_modules/zod",
  optional: true,
});
await writeFile(new URL("dependency-patches.json", builtSecurity), JSON.stringify(manifest));
