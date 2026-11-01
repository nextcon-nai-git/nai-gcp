import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedJob,
  parseOptions,
  plan,
  runProvisioning,
} from "./setup-esocial-infrastructure.mjs";

const number = "123456789012";
const copy = (value) => structuredClone(value);
const notFound = () => Object.assign(new Error("private-provider-error"), { code: 404 });
const flags = (args) => parseOptions(args.split(" ").filter(Boolean));
function fixture(overrides = {}) {
  const writes = [];
  const reads = [];
  const state = {
    apiEnabled: true,
    secretExists: true,
    versions: [],
    invoker: { email: plan.invokerAccount, disabled: false },
    policy: {
      version: 3,
      etag: "opaque-etag",
      bindings: [
        "roles/secretmanager.secretAccessor",
        "roles/secretmanager.secretVersionAdder",
      ].map((role) => ({ role, members: [`serviceAccount:${plan.runtimeAccount}`] })),
    },
    projectPolicy: {
      bindings: [
        {
          role: "roles/cloudscheduler.serviceAgent",
          members: [
            `serviceAccount:service-${number}@gcp-sa-cloudscheduler.iam.gserviceaccount.com`,
          ],
        },
      ],
    },
    job: { ...expectedJob(), state: "ENABLED" },
    ...overrides,
  };
  const read = (name, fn) => async (args) => {
    reads.push({ name, args: copy(args) });
    return { data: copy(fn(args)) };
  };
  const write = (name, fn) => async (args) => {
    writes.push({ name, args: copy(args) });
    return { data: copy(fn(args)) };
  };
  const clients = {
    projects: {
      projects: {
        get: read("project.get", () => ({ projectNumber: number })),
        getIamPolicy: read("project.getIamPolicy", () => state.projectPolicy),
      },
    },
    services: {
      services: {
        get: read("api.get", () => ({ state: state.apiEnabled ? "ENABLED" : "DISABLED" })),
        enable: write("api.enable", () => {
          state.apiEnabled = true;
          return { done: true };
        }),
      },
      operations: { get: read("operation.get", () => ({ done: true })) },
    },
    identities: {
      projects: {
        serviceAccounts: {
          get: read("account.get", () => {
            if (!state.invoker) throw notFound();
            return state.invoker;
          }),
          create: write("account.create", () => {
            state.invoker = { email: plan.invokerAccount };
            return state.invoker;
          }),
        },
      },
    },
    secrets: {
      projects: {
        secrets: {
          get: read("vault.get", () => {
            if (!state.secretExists) throw notFound();
            return { name: plan.secret };
          }),
          create: write("vault.create", () => {
            state.secretExists = true;
            return { name: plan.secret };
          }),
          getIamPolicy: read("vault.getIamPolicy", () => state.policy),
          setIamPolicy: write("vault.setIamPolicy", (args) => {
            state.policy = copy(args.requestBody.policy);
            return state.policy;
          }),
          versions: { list: read("versions.list", () => ({ versions: state.versions })) },
        },
      },
    },
    scheduler: {
      projects: {
        locations: {
          jobs: {
            get: read("job.get", () => {
              if (!state.job) throw notFound();
              return state.job;
            }),
            create: write("job.create", (args) => {
              state.job = { ...copy(args.requestBody), state: "ENABLED" };
              return state.job;
            }),
            patch: write("job.patch", (args) => {
              state.job = { ...state.job, ...copy(args.requestBody) };
              return state.job;
            }),
          },
        },
      },
    },
  };
  return { clients, state, writes, reads };
}

test("dry-run needs no googleapis, credentials or live clients", async () => {
  const result = await runProvisioning(null, flags(""));
  assert.equal(result.mode, "dry-run");
  assert.equal(result.vaultEmpty, undefined);
});

test("invalid CLI modes fail before live clients", () => {
  for (const value of ["--bootstrap", "--apply --verify", "--bootstrap --verify", "--unknown"])
    assert.throws(() => flags(value));
});

test("invalid library options fail before reads or writes", async () => {
  for (const options of [
    null,
    { apply: true, verify: true },
    { verify: true, bootstrap: true },
    { bootstrap: true },
    { apply: "true" },
    { apply: true, unexpected: true },
  ]) {
    const f = fixture();
    await assert.rejects(runProvisioning(f.clients, options), /Invalid provisioning options/);
    assert.equal(f.reads.length + f.writes.length, 0);
  }
});

test("verify reads metadata without claiming operational success", async () => {
  const f = fixture();
  const result = await runProvisioning(f.clients, flags("--verify --require-empty"));
  assert.equal(result.mode, "verified");
  assert.equal(result.vaultEmpty, true);
  assert.equal(result.operationalExecutionVerified, false);
  assert.equal(result.certificatePayloadRead, false);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(
    f.reads.filter((r) => r.name === "versions.list").map((r) => r.args),
    [
      { parent: plan.secret, pageSize: 1 },
      { parent: plan.secret, pageSize: 1 },
    ]
  );
});

test("existing versions are reported honestly", async () => {
  const f = fixture({ versions: [{ name: `${plan.secret}/versions/1`, state: "ENABLED" }] });
  const result = await runProvisioning(f.clients, flags("--verify"));
  assert.equal(result.vaultEmpty, false);
  assert.equal(result.vaultVersionState, "present");
  assert.equal(f.writes.length, 0);
});

test("require-empty blocks identity, IAM and job writes", async () => {
  for (const mode of ["--apply", "--bootstrap --apply", "--verify"]) {
    const f = fixture({ versions: [{ name: `${plan.secret}/versions/1`, state: "DESTROYED" }] });
    await assert.rejects(runProvisioning(f.clients, flags(`${mode} --require-empty`)), {
      stage: "vault-empty-check",
    });
    assert.equal(f.writes.length, 0);
    assert.equal(
      f.reads.some((r) => r.name === "account.get" || r.name === "job.get"),
      false
    );
  }
});

test("maintenance updates only the existing OIDC job", async () => {
  const f = fixture();
  f.state.job.name = f.state.job.name.replace(`projects/${plan.project}/`, `projects/${number}/`);
  f.state.job.schedule = "1 * * * *";
  const result = await runProvisioning(f.clients, flags("--apply --require-empty"));
  assert.deepEqual(
    f.writes.map((w) => w.name),
    ["job.patch"]
  );
  assert.deepEqual(f.writes[0].args.requestBody, expectedJob());
  assert.equal(result.schedulerConfigurationConfirmed, true);
});

test("maintenance and verification refuse an absent scheduler without writes", async () => {
  for (const mode of ["--apply", "--verify"]) {
    const f = fixture({ job: null });
    await assert.rejects(runProvisioning(f.clients, flags(`${mode} --require-empty`)), {
      stage: "scheduler",
      httpStatus: 404,
    });
    assert.equal(f.writes.length, 0);
    assert.equal(f.state.job, null);
  }
});

test("invalid scheduler metadata is rejected before any job mutation", async () => {
  for (const mode of ["--apply", "--bootstrap --apply", "--verify"]) {
    for (const data of [null, undefined, {}, [], "unexpected", { name: `${plan.scheduler}-other` }]) {
      const f = fixture();
      f.clients.scheduler.projects.locations.jobs.get = async () => ({ data });
      await assert.rejects(runProvisioning(f.clients, flags(`${mode} --require-empty`)), {
        stage: "scheduler",
      });
      assert.equal(f.writes.length, 0);
    }
  }
});

test("only explicit bootstrap creates the expected OIDC job", async () => {
  const f = fixture({ job: null });
  const result = await runProvisioning(f.clients, flags("--bootstrap --apply --require-empty"));
  assert.deepEqual(
    f.writes.map((w) => w.name),
    ["job.create"]
  );
  assert.deepEqual(f.writes[0].args.requestBody, expectedJob());
  assert.equal(result.mode, "bootstrapped");
  assert.equal(result.schedulerConfigurationConfirmed, true);
});

test("scheduler authorization and network failures never become creation", async () => {
  for (const mode of ["--apply", "--bootstrap --apply"]) {
    for (const code of [403, 500]) {
      const f = fixture();
      f.clients.scheduler.projects.locations.jobs.get = async () => {
        throw Object.assign(new Error("private-scheduler-error"), { code });
      };
      await assert.rejects(runProvisioning(f.clients, flags(`${mode} --require-empty`)), {
        stage: "scheduler",
        httpStatus: code,
      });
      assert.equal(f.writes.length, 0);
    }
  }
});

test("maintenance never bootstraps API, account, vault or IAM", async () => {
  for (const [overrides, stage] of [
    [{ apiEnabled: false }, "apis"],
    [{ secretExists: false }, "vault-metadata"],
    [{ invoker: null }, "invoker-account"],
    [{ policy: { bindings: [] } }, "vault-iam"],
  ]) {
    const f = fixture(overrides);
    await assert.rejects(runProvisioning(f.clients, flags("--apply --require-empty")), { stage });
    assert.equal(f.writes.length, 0);
  }
});

test("bootstrap preserves existing vault policy and etag", async () => {
  const unrelated = {
    role: "roles/secretmanager.viewer",
    members: ["user:operator@example.test"],
    condition: { title: "retained", expression: "true" },
  };
  const f = fixture({
    apiEnabled: false,
    secretExists: false,
    invoker: null,
    job: null,
    policy: { version: 3, etag: "original-etag", bindings: [unrelated] },
  });
  const result = await runProvisioning(f.clients, flags("--bootstrap --apply --require-empty"));
  assert.deepEqual(
    f.writes.map((w) => w.name),
    ["api.enable", "vault.create", "account.create", "vault.setIamPolicy", "job.create"]
  );
  const request = f.writes.find((w) => w.name === "vault.setIamPolicy").args;
  assert.equal(request.resource, plan.secret);
  assert.equal(request.requestBody.policy.etag, "original-etag");
  assert.deepEqual(request.requestBody.policy.bindings[0], unrelated);
  assert.equal(request.requestBody.policy.bindings.length, 3);
  assert.equal(result.mode, "bootstrapped");
});

test("service agent needs an unconditional role, without IAM writes", async () => {
  for (const projectPolicy of [
    { bindings: [] },
    {
      bindings: [
        {
          role: "roles/cloudscheduler.serviceAgent",
          members: [
            `serviceAccount:service-${number}@gcp-sa-cloudscheduler.iam.gserviceaccount.com`,
          ],
          condition: { expression: "true" },
        },
      ],
    },
  ]) {
    const f = fixture({ projectPolicy });
    await assert.rejects(runProvisioning(f.clients, flags("--bootstrap --apply --require-empty")), {
      stage: "scheduler-service-agent",
    });
    assert.equal(f.writes.length, 0);
  }
});

test("invoker must be active and have no direct project/vault roles", async () => {
  const f1 = fixture({ invoker: { email: plan.invokerAccount, disabled: true } });
  await assert.rejects(runProvisioning(f1.clients, flags("--apply")), { stage: "invoker-account" });
  const f2 = fixture();
  f2.state.projectPolicy.bindings.push({
    role: "roles/editor",
    members: [`serviceAccount:${plan.invokerAccount}`],
  });
  await assert.rejects(runProvisioning(f2.clients, flags("--apply")), {
    stage: "scheduler-service-agent",
  });
  const f3 = fixture();
  f3.state.policy.bindings.push({
    role: "roles/secretmanager.secretAccessor",
    members: [`serviceAccount:${plan.invokerAccount}`],
  });
  await assert.rejects(runProvisioning(f3.clients, flags("--apply")), { stage: "vault-iam" });
  assert.equal(f1.writes.length + f2.writes.length + f3.writes.length, 0);
});

test("an operator's existing scheduler pause is preserved", async () => {
  const f = fixture({ job: { ...expectedJob(), state: "PAUSED" } });
  const result = await runProvisioning(f.clients, flags("--apply"));
  assert.equal(result.schedulerState, "PAUSED");
  assert.equal(result.schedulerEnabled, false);
  assert.equal(f.writes[0].args.requestBody.state, undefined);
});

test("verify rejects meaningful scheduler drift without writing", async () => {
  const mutations = [
    (job) => {
      job.description = "different";
    },
    (job) => {
      job.schedule = "* * * * *";
    },
    (job) => {
      job.timeZone = "Etc/UTC";
    },
    (job) => {
      job.attemptDeadline = "600s";
    },
    (job) => {
      job.retryConfig.retryCount = 2;
    },
    (job) => {
      job.retryConfig.maxRetryDuration = "120s";
    },
    (job) => {
      job.httpTarget.uri += "/other";
    },
    (job) => {
      job.httpTarget.httpMethod = "GET";
    },
    (job) => {
      job.httpTarget.oidcToken.audience += "/other";
    },
    (job) => {
      job.httpTarget.oidcToken.serviceAccountEmail = "wrong@example.test";
    },
    (job) => {
      job.httpTarget.oauthToken = { serviceAccountEmail: plan.invokerAccount };
    },
    (job) => {
      job.httpTarget.body = Buffer.from('{"action":"transmit"}').toString("base64");
    },
    (job) => {
      job.httpTarget.headers["Content-Type"] = "text/plain";
    },
    (job) => {
      job.httpTarget.headers.authorization = "Bearer private-token";
    },
    (job) => {
      job.pubsubTarget = { topicName: "unexpected" };
    },
    (job) => {
      job.state = "DISABLED";
    },
  ];
  for (const mutate of mutations) {
    const f = fixture();
    mutate(f.state.job);
    await assert.rejects(runProvisioning(f.clients, flags("--verify")), { stage: "verification" });
    assert.equal(f.writes.length, 0);
  }
});

test("verify accepts canonical project and omitted protobuf zeros", async () => {
  const f = fixture();
  f.state.job.name = f.state.job.name.replace(`projects/${plan.project}/`, `projects/${number}/`);
  f.state.job.retryConfig = {};
  f.state.job.httpTarget.headers = {
    "content-type": "application/json",
    "User-Agent": "Google-Cloud-Scheduler",
  };
  assert.equal(
    (await runProvisioning(f.clients, flags("--verify"))).schedulerConfigurationConfirmed,
    true
  );
});

test("provider errors expose only stage and HTTP status", async () => {
  const f = fixture();
  f.clients.secrets.projects.secrets.get = async () => {
    throw Object.assign(new Error("private-token-and-certificate"), {
      code: 403,
      response: { status: 403 },
    });
  };
  await assert.rejects(runProvisioning(f.clients, flags("--apply")), (error) => {
    assert.equal(error.stage, "vault-metadata");
    assert.equal(error.httpStatus, 403);
    assert.equal(error.message.includes("private-token"), false);
    return true;
  });
  assert.equal(f.writes.length, 0);
});

test("late vault changes fail without accessing any payload", async () => {
  const f = fixture();
  let lists = 0;
  f.clients.secrets.projects.secrets.versions.list = async () => ({
    data: { versions: ++lists === 1 ? [] : [{ name: `${plan.secret}/versions/1` }] },
  });
  await assert.rejects(runProvisioning(f.clients, flags("--verify --require-empty")), {
    stage: "verification",
  });
  assert.equal(f.writes.length, 0);
});
