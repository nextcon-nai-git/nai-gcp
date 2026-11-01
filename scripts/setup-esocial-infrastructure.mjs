#!/usr/bin/env node
/** Empty-vault/query-only infrastructure. Never uploads or reads certificate payloads. */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const project = "studio-8439299034-125c7";
const location = "us-central1";
const runtimeAccount = `firebase-app-hosting-compute@${project}.iam.gserviceaccount.com`;
const invokerAccount = `nai-esocial-query@${project}.iam.gserviceaccount.com`;
const secret = `projects/${project}/secrets/nai-esocial-a1`;
const audience = `https://nai--${project}.${location}.hosted.app/api/internal/esocial-sync`;
const parent = `projects/${project}/locations/${location}`;
const jobName = `${parent}/jobs/nai-esocial-query`;
const runtimeRoles = [
  "roles/secretmanager.secretAccessor",
  "roles/secretmanager.secretVersionAdder",
];
const apiOptions = { timeout: 20000, retry: false };
const status = (error) => Number(error?.response?.status || error?.code || 0);

export const plan = {
  project,
  secret,
  runtimeAccount,
  invokerAccount,
  scheduler: jobName,
  schedule: "*/5 * * * *",
  audience,
  scope: "metadata, scoped vault IAM during explicit bootstrap, and query-only scheduler",
};

export function parseOptions(args) {
  const allowed = new Set(["--apply", "--bootstrap", "--verify", "--require-empty"]);
  if (args.some((arg) => !allowed.has(arg))) throw new Error("Unsupported argument.");
  const apply = args.includes("--apply");
  const verify = args.includes("--verify");
  const bootstrap = args.includes("--bootstrap");
  if ((apply && verify) || (bootstrap && (!apply || verify)))
    throw new Error("Use --apply, --verify, or --bootstrap --apply.");
  return { apply, verify, bootstrap, requireEmpty: args.includes("--require-empty") };
}

export function expectedJob() {
  return {
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
}

function hasBinding(policy, role, member) {
  return policy.bindings?.some(
    (binding) => binding.role === role && !binding.condition && binding.members?.includes(member)
  );
}

export function verifyJob(job, projectNumber) {
  const expected = expectedJob();
  const target = job.httpTarget;
  const headers = Object.entries(target?.headers || {});
  const contentType = headers.find(([key]) => key.toLowerCase() === "content-type")?.[1];
  const nameMatches = [
    jobName,
    jobName.replace(`projects/${project}/`, `projects/${projectNumber}/`),
  ].includes(job.name);
  if (
    !nameMatches ||
    job.description !== expected.description ||
    job.schedule !== expected.schedule ||
    job.timeZone !== expected.timeZone ||
    job.attemptDeadline !== expected.attemptDeadline ||
    (job.retryConfig?.retryCount ?? 0) !== 0 ||
    (job.retryConfig?.maxRetryDuration ?? "0s") !== "0s" ||
    target?.uri !== audience ||
    target?.httpMethod !== "POST" ||
    target?.oidcToken?.serviceAccountEmail !== invokerAccount ||
    target?.oidcToken?.audience !== audience ||
    target?.oauthToken ||
    target?.body !== expected.httpTarget.body ||
    contentType !== "application/json" ||
    headers.some(([key]) => key.toLowerCase() === "authorization") ||
    job.pubsubTarget ||
    job.appEngineHttpTarget ||
    !["ENABLED", "PAUSED"].includes(job.state)
  )
    throw new Error("Scheduler configuration not confirmed.");
}

/** Clients are injected for isolated tests; ADC and googleapis are loaded only for live modes. */
export async function runProvisioning(
  clients,
  options = parseOptions([]),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
) {
  const keys = ["apply", "verify", "bootstrap", "requireEmpty"];
  if (
    !options ||
    typeof options !== "object" ||
    Object.keys(options).some((key) => !keys.includes(key) || typeof options[key] !== "boolean") ||
    (options.apply && options.verify) ||
    (options.bootstrap && !options.apply)
  )
    throw new Error("Invalid provisioning options.");
  if (!options.apply && !options.verify) return { mode: "dry-run", ...plan };
  const { projects, services, identities, secrets, scheduler } = clients;
  let stage = "project";
  try {
    const projectNumber = (await projects.projects.get({ projectId: project }, apiOptions)).data
      .projectNumber;
    if (!/^[1-9]\d*$/.test(String(projectNumber || ""))) throw new Error("Project not confirmed.");
    stage = "apis";
    for (const service of [
      "secretmanager.googleapis.com",
      "cloudscheduler.googleapis.com",
      "iam.googleapis.com",
    ]) {
      const name = `projects/${projectNumber}/services/${service}`;
      if ((await services.services.get({ name }, apiOptions)).data.state === "ENABLED") continue;
      if (!options.bootstrap) throw new Error("An operator must bootstrap the required APIs.");
      let operation = (await services.services.enable({ name, requestBody: {} }, apiOptions)).data;
      for (let attempt = 0; !operation.done && !operation.error && attempt < 20; attempt++) {
        if (!operation.name) throw new Error("Missing service activation operation.");
        await sleep(3000);
        operation = (await services.operations.get({ name: operation.name }, apiOptions)).data;
      }
      if (
        operation.error ||
        (await services.services.get({ name }, apiOptions)).data.state !== "ENABLED"
      )
        throw new Error("Service activation not confirmed.");
    }

    // Check existing contents before creating identities or changing any vault IAM/job.
    stage = "vault-metadata";
    try {
      await secrets.projects.secrets.get({ name: secret }, apiOptions);
    } catch (error) {
      if (status(error) !== 404 || !options.bootstrap) throw error;
      await secrets.projects.secrets.create(
        {
          parent: `projects/${project}`,
          secretId: "nai-esocial-a1",
          requestBody: {
            replication: { automatic: {} },
            labels: { app: "nai", purpose: "esocial-a1" },
          },
        },
        apiOptions
      );
    }
    const vaultState = async () => {
      const response = await secrets.projects.secrets.versions.list(
        { parent: secret, pageSize: 1 },
        apiOptions
      );
      return !(response.data.versions?.length || response.data.nextPageToken);
    };
    stage = "vault-empty-check";
    const vaultEmptyBefore = await vaultState();
    if (options.requireEmpty && !vaultEmptyBefore)
      throw new Error("Vault already contains versions; no IAM or scheduler changes permitted.");

    stage = "scheduler-service-agent";
    const agent = `serviceAccount:service-${projectNumber}@gcp-sa-cloudscheduler.iam.gserviceaccount.com`;
    const projectPolicy = (
      await projects.projects.getIamPolicy(
        {
          resource: project,
          requestBody: { options: { requestedPolicyVersion: 3 } },
        },
        apiOptions
      )
    ).data;
    if (!hasBinding(projectPolicy, "roles/cloudscheduler.serviceAgent", agent))
      throw new Error("An operator must restore the existing Cloud Scheduler service agent role.");
    if (
      projectPolicy.bindings?.some((binding) =>
        binding.members?.includes(`serviceAccount:${invokerAccount}`)
      )
    )
      throw new Error(
        "The dedicated query identity has unexpected project roles; operator review required."
      );

    stage = "invoker-account";
    let invoker;
    try {
      invoker = (
        await identities.projects.serviceAccounts.get(
          { name: `projects/${project}/serviceAccounts/${invokerAccount}` },
          apiOptions
        )
      ).data;
    } catch (error) {
      if (status(error) !== 404 || !options.bootstrap) throw error;
      invoker = (
        await identities.projects.serviceAccounts.create(
          {
            name: `projects/${project}`,
            requestBody: {
              accountId: "nai-esocial-query",
              serviceAccount: { displayName: "NAI eSocial query scheduler" },
            },
          },
          apiOptions
        )
      ).data;
    }
    if (invoker.email !== invokerAccount || invoker.disabled === true)
      throw new Error("Query identity not confirmed.");

    stage = "vault-iam";
    const member = `serviceAccount:${runtimeAccount}`;
    const readVaultPolicy = async () =>
      (
        await secrets.projects.secrets.getIamPolicy(
          { resource: secret, "options.requestedPolicyVersion": 3 },
          apiOptions
        )
      ).data;
    let policy = await readVaultPolicy();
    if (
      policy.bindings?.some((binding) => binding.members?.includes(`serviceAccount:${invokerAccount}`))
    )
      throw new Error(
        "The dedicated query identity has unexpected vault grants; operator review required."
      );
    if (!runtimeRoles.every((role) => hasBinding(policy, role, member))) {
      if (!options.bootstrap)
        throw new Error("An operator must bootstrap the scoped runtime vault grants.");
      const bindings = (policy.bindings || []).map((binding) => ({
        ...binding,
        members: [...(binding.members || [])],
      }));
      for (const role of runtimeRoles) {
        const binding = bindings.find((b) => b.role === role && !b.condition);
        if (binding) binding.members = [...new Set([...binding.members, member])];
        else bindings.push({ role, members: [member] });
      }
      await secrets.projects.secrets.setIamPolicy(
        { resource: secret, requestBody: { policy: { ...policy, bindings } } },
        apiOptions
      );
      policy = await readVaultPolicy();
    }
    if (!runtimeRoles.every((role) => hasBinding(policy, role, member)))
      throw new Error("Scoped runtime vault grants not confirmed.");

    stage = "scheduler";
    let existing;
    try {
      existing = (await scheduler.projects.locations.jobs.get({ name: jobName }, apiOptions)).data;
    } catch (error) {
      if (status(error) !== 404 || options.verify) throw error;
    }
    if (options.apply) {
      if (existing) {
        await scheduler.projects.locations.jobs.patch(
          {
            name: jobName,
            updateMask: "description,schedule,timeZone,attemptDeadline,retryConfig,httpTarget",
            requestBody: expectedJob(),
          },
          apiOptions
        );
      } else {
        await scheduler.projects.locations.jobs.create(
          { parent, requestBody: expectedJob() },
          apiOptions
        );
      }
    }
    stage = "verification";
    const scheduled = (await scheduler.projects.locations.jobs.get({ name: jobName }, apiOptions))
      .data;
    verifyJob(scheduled, projectNumber);
    if (existing?.state === "PAUSED" && scheduled.state !== "PAUSED")
      throw new Error("The existing deliberate scheduler pause was not preserved.");
    const vaultEmpty = await vaultState();
    if (options.requireEmpty && !vaultEmpty)
      throw new Error("Vault changed during provisioning; empty state not confirmed.");
    return {
      mode: options.verify ? "verified" : options.bootstrap ? "bootstrapped" : "provisioned",
      ...plan,
      projectNumber: String(projectNumber),
      vaultEmpty,
      vaultVersionState: vaultEmpty ? "empty" : "present",
      runtimeVaultRolesConfirmed: true,
      schedulerServiceAgentConfirmed: true,
      schedulerConfigurationConfirmed: true,
      schedulerState: scheduled.state,
      schedulerEnabled: scheduled.state === "ENABLED",
      operationalExecutionVerified: false,
      certificatePayloadRead: false,
      certificateUploadedByThisRun: false,
      eventsSentByThisRun: false,
      emailsSentByThisRun: false,
    };
  } catch (error) {
    // Never emit provider error messages, Gaxios requests, credentials, tokens or payloads.
    const safe = new Error(
      `Provisionamento eSocial incompleto; etapa=${stage}; HTTP=${status(error) || "indisponível"}. Confira o bootstrap, as permissões e os metadados esperados.`
    );
    safe.stage = stage;
    safe.httpStatus = status(error);
    throw safe;
  }
}

function createClients() {
  const require = createRequire(import.meta.url);
  const { auth, secretmanager } = require("googleapis/build/src/apis/secretmanager");
  const { cloudscheduler } = require("googleapis/build/src/apis/cloudscheduler");
  const { serviceusage } = require("googleapis/build/src/apis/serviceusage");
  const { iam } = require("googleapis/build/src/apis/iam");
  const { cloudresourcemanager } = require("googleapis/build/src/apis/cloudresourcemanager");
  const credentials = new auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  return {
    secrets: secretmanager({ version: "v1", auth: credentials }),
    scheduler: cloudscheduler({ version: "v1", auth: credentials }),
    services: serviceusage({ version: "v1", auth: credentials }),
    identities: iam({ version: "v1", auth: credentials }),
    projects: cloudresourcemanager({ version: "v1", auth: credentials }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    const result = await runProvisioning(
      options.apply || options.verify ? createClients() : null,
      options
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    // Dependency/ADC errors outside runProvisioning also receive a fixed, private diagnostic.
    process.stderr.write(
      `${error?.stage ? error.message : "Configuração inválida: confira argumentos, dependências e autenticação ADC/WIF."}\n`
    );
    process.exitCode = 1;
  }
}
