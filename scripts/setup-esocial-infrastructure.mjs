#!/usr/bin/env node
/** Provisions only an empty certificate vault and a query-only scheduler. Never reads a PFX. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { auth, secretmanager } = require("googleapis/build/src/apis/secretmanager");
const { cloudscheduler } = require("googleapis/build/src/apis/cloudscheduler");
const { serviceusage } = require("googleapis/build/src/apis/serviceusage");
const { iam } = require("googleapis/build/src/apis/iam");
const { cloudresourcemanager } = require("googleapis/build/src/apis/cloudresourcemanager");

const project = "studio-8439299034-125c7";
const location = "us-central1";
const serviceAccount = `firebase-app-hosting-compute@${project}.iam.gserviceaccount.com`;
const invokerAccount = `nai-esocial-query@${project}.iam.gserviceaccount.com`;
const secret = `projects/${project}/secrets/nai-esocial-a1`;
const audience = `https://nai--${project}.${location}.hosted.app/api/internal/esocial-sync`;
const parent = `projects/${project}/locations/${location}`;
const jobName = `${parent}/jobs/nai-esocial-query`;
const plan = {
  project,
  secret,
  serviceAccount,
  invokerAccount,
  scheduler: jobName,
  schedule: "*/5 * * * *",
  audience,
  certificateUploaded: false,
  automaticTransmission: false,
  clientEmail: false,
};

if (!process.argv.includes("--apply")) {
  process.stdout.write(`${JSON.stringify({ mode: "dry-run", ...plan }, null, 2)}\n`);
  process.exit(0);
}
const credentials = new auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const secrets = secretmanager({ version: "v1", auth: credentials });
const scheduler = cloudscheduler({ version: "v1", auth: credentials });
const services = serviceusage({ version: "v1", auth: credentials });
const identities = iam({ version: "v1", auth: credentials });
const projects = cloudresourcemanager({ version: "v1", auth: credentials });
let projectNumber;
const options = { timeout: 20000, retry: false };
const status = (error) => Number(error?.response?.status || error?.code || 0);
async function enable(name) {
  const existing = await services.services.get(
    { name: `projects/${projectNumber}/services/${name}` },
    options
  );
  if (existing.data.state === "ENABLED") return;
  const result = await services.services.enable(
    { name: `projects/${projectNumber}/services/${name}`, requestBody: {} },
    options
  );
  if (result.data.error) throw new Error(`Falha ao ativar ${name}.`);
  for (let attempt = 0; !result.data.done && attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const operation = await services.operations.get({ name: result.data.name }, options);
    if (operation.data.error) throw new Error(`Falha ao ativar ${name}.`);
    if (operation.data.done) return;
  }
  if (!result.data.done) {
    const checked = await services.services.get(
      { name: `projects/${projectNumber}/services/${name}` },
      options
    );
    if (checked.data.state !== "ENABLED") throw new Error(`Ativação de ${name} ainda pendente.`);
  }
}
try {
  projectNumber = (await projects.projects.get({ projectId: project }, options)).data.projectNumber;
  if (!/^\d+$/.test(projectNumber || "")) throw new Error("Projeto de destino não confirmado.");
  await enable("secretmanager.googleapis.com");
  await enable("cloudscheduler.googleapis.com");
  await enable("iam.googleapis.com");
  // This account receives no Secret Manager, Firestore or signing permissions.
  // The scheduler invokes only the narrowly authenticated query route.
  try {
    await identities.projects.serviceAccounts.get(
      { name: `projects/${project}/serviceAccounts/${invokerAccount}` },
      options
    );
  } catch (error) {
    if (status(error) !== 404) throw error;
    await identities.projects.serviceAccounts.create(
      {
        name: `projects/${project}`,
        requestBody: {
          accountId: "nai-esocial-query",
          serviceAccount: { displayName: "NAI eSocial query scheduler" },
        },
      },
      options
    );
  }
  try {
    await secrets.projects.secrets.get({ name: secret }, options);
  } catch (error) {
    if (status(error) !== 404) throw error;
    // No version/payload is created. Only the user-facing upload adds certificate material.
    await secrets.projects.secrets.create(
      {
        parent: `projects/${project}`,
        secretId: "nai-esocial-a1",
        requestBody: {
          replication: { automatic: {} },
          labels: { app: "nai", purpose: "esocial-a1" },
        },
      },
      options
    );
  }
  const policy = (
    await secrets.projects.secrets.getIamPolicy(
      { resource: secret, "options.requestedPolicyVersion": 3 },
      options
    )
  ).data;
  const member = `serviceAccount:${serviceAccount}`;
  const bindings = [...(policy.bindings || [])];
  for (const role of [
    "roles/secretmanager.secretAccessor",
    "roles/secretmanager.secretVersionAdder",
  ]) {
    const binding = bindings.find((b) => b.role === role && !b.condition);
    if (binding) binding.members = [...new Set([...(binding.members || []), member])];
    else bindings.push({ role, members: [member] });
  }
  await secrets.projects.secrets.setIamPolicy(
    { resource: secret, requestBody: { policy: { ...policy, bindings } } },
    options
  );
  const job = {
    name: jobName,
    description:
      "NAI eSocial: consulta lotes já transmitidos; nunca assina, transmite eventos novos ou envia emails.",
    schedule: "*/5 * * * *",
    timeZone: "America/Sao_Paulo",
    attemptDeadline: "240s",
    retryConfig: { retryCount: 0, maxRetryDuration: "0s" },
    httpTarget: {
      uri: audience,
      httpMethod: "POST",
      oidcToken: { serviceAccountEmail: invokerAccount, audience },
      headers: { "Content-Type": "application/json" },
      body: Buffer.from("{}").toString("base64"),
    },
  };
  try {
    await scheduler.projects.locations.jobs.get({ name: jobName }, options);
    await scheduler.projects.locations.jobs.patch(
      {
        name: jobName,
        updateMask: "description,schedule,timeZone,attemptDeadline,retryConfig,httpTarget",
        requestBody: job,
      },
      options
    );
  } catch (error) {
    if (status(error) !== 404) throw error;
    await scheduler.projects.locations.jobs.create({ parent, requestBody: job }, options);
  }
  const [vault, scheduled] = await Promise.all([
    secrets.projects.secrets.getIamPolicy(
      { resource: secret, "options.requestedPolicyVersion": 3 },
      options
    ),
    scheduler.projects.locations.jobs.get({ name: jobName }, options),
  ]);
  const hasRoles = [
    "roles/secretmanager.secretAccessor",
    "roles/secretmanager.secretVersionAdder",
  ].every((role) =>
    vault.data.bindings?.some((b) => b.role === role && !b.condition && b.members?.includes(member))
  );
  if (
    !hasRoles ||
    scheduled.data.httpTarget?.oidcToken?.audience !== audience ||
    scheduled.data.httpTarget?.oidcToken?.serviceAccountEmail !== invokerAccount ||
    !["ENABLED", "PAUSED"].includes(scheduled.data.state)
  )
    throw new Error("Provisionamento não confirmado; confira IAM e o estado do agendador.");
  // Preserve an operator's deliberate pause; never silently resume an existing job.
  process.stdout.write(
    `${JSON.stringify({ mode: "provisioned", ...plan, schedulerState: scheduled.data.state, schedulerEnabled: scheduled.data.state === "ENABLED" }, null, 2)}\n`
  );
} catch (error) {
  // Never emit Gaxios request objects, credential payloads, tokens or full environment.
  process.stderr.write(
    `Provisionamento eSocial incompleto (HTTP ${status(error) || "indisponível"}). Confira permissões de Secret Manager, Service Usage, Cloud Scheduler e iam.serviceAccounts.actAs no ambiente de produção.\n`
  );
  process.exitCode = 1;
}
