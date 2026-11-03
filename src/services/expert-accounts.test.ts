import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  collection: vi.fn(),
  preview: vi.fn(),
  manage: vi.fn(),
  provider: {} as Record<string, unknown>,
  account: null as Record<string, unknown> | null,
  warning: "",
  adminProfile: undefined as Record<string, unknown> | undefined,
  onDataRead: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: m.collection } }));
vi.mock("./user-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./user-access")>()),
  previewUserAccess: m.preview,
  manageUserAccess: m.manage,
}));
import { createExpertAccount, previewExpertAccount, listExpertAccounts } from "./expert-accounts";
import { AuthError } from "@/lib/auth/errors";
import type { AuthContext } from "@/lib/auth/auth-context";
const admin: AuthContext = {
  uid: "admin",
  email: "admin@example.test",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  m.account = null;
  m.warning = "";
  m.adminProfile = { role: "SUPER_ADMIN", accessEnabled: true };
  m.provider = {
    name: "Perito sintético",
    active: true,
    email: "expert@example.test",
    servedCompanies: ["allowed"],
  };
  m.collection.mockImplementation((collection: string) => ({
    doc: (id = "audit") => ({
      collection,
      id,
      get: async () => {
        if (collection !== "users") m.onDataRead();
        return {
          exists: collection !== "users" || m.adminProfile !== undefined,
          data: () =>
            collection === "users"
              ? m.adminProfile
              : collection === "providers"
                ? m.provider
                : { name: "Empresa sintética" },
        };
      },
    }),
    limit: () => ({
      get: async () => {
        m.onDataRead();
        return {
          size: 1,
          docs:
            collection === "providers"
              ? [{ id: "provider", data: () => m.provider }]
              : [{ id: "allowed", data: () => ({ name: "Empresa sintética" }) }],
        };
      },
    }),
  }));
  m.preview.mockImplementation(async () => ({
    name: m.provider.name,
    email: m.provider.email,
    companyIds: m.provider.servedCompanies,
    accessUid: m.provider.accessUid || "",
    active: m.provider.active,
    revision: "current-managed-access-revision",
    account: m.account,
    warning: m.warning,
  }));
  m.manage.mockResolvedValue({ success: true, message: "Acesso atualizado." });
});
const input = async () => ({
  providerId: "provider",
  revision: (await previewExpertAccount(admin, "provider")).revision,
  password: "Synthetic-test-only-42",
});

it("uses the canonical grant workflow and its current revision instead of enabling a separate identity", async () => {
  const body = await input();
  const response = await createExpertAccount(admin, body);
  expect(response).toEqual({ created: true, alreadyExists: false, email: "expert@example.test" });
  expect(m.preview).toHaveBeenCalledExactlyOnceWith(admin, "provider", "provider");
  expect(m.manage).toHaveBeenCalledExactlyOnceWith(admin, {
    kind: "provider",
    id: "provider",
    action: "create",
    revision: "current-managed-access-revision",
    role: "SCOPED_PROVIDER",
    companyIds: ["allowed"],
    password: body.password,
  });
  expect(JSON.stringify(response)).not.toContain(body.password);
});

it("does not bypass a current administrative revocation with the initial SUPER_ADMIN context", async () => {
  const body = await input();
  m.preview.mockRejectedValue(new AuthError("Acesso administrativo suspenso.", 403));
  await expect(createExpertAccount(admin, body)).rejects.toMatchObject({ status: 403 });
  expect(m.manage).not.toHaveBeenCalled();
});

it.each([403, 409, 503])(
  "never reports a completed grant when the canonical operation rejects with %s",
  async (status) => {
    const body = await input();
    m.manage.mockRejectedValue(new AuthError("Concessão não confirmada.", status));
    await expect(createExpertAccount(admin, body)).rejects.toMatchObject({ status });
    expect(m.manage).toHaveBeenCalledOnce();
  }
);

it("rejects changed provider links before requesting a grant", async () => {
  const body = await input();
  m.provider.servedCompanies = ["other"];
  await expect(createExpertAccount(admin, body)).rejects.toMatchObject({ status: 409 });
  expect(m.manage).not.toHaveBeenCalled();
});

it("never adopts or replaces an unrelated existing email account", async () => {
  m.warning = "Já existe conta com este e-mail.";
  await expect(createExpertAccount(admin, await input())).rejects.toMatchObject({ status: 409 });
  expect(m.manage).not.toHaveBeenCalled();
});

it.each([
  { enabled: false, role: "SCOPED_PROVIDER", companyIds: ["allowed"] },
  { enabled: true, role: "ADMIN", companyIds: ["allowed"] },
  { enabled: true, role: "SCOPED_PROVIDER", companyIds: ["other"] },
])("requires review of an inconsistent existing grant (%j)", async (account) => {
  m.provider.accessUid = "existing";
  m.account = { uid: "existing", ...account };
  await expect(createExpertAccount(admin, await input())).rejects.toMatchObject({ status: 409 });
  expect(m.manage).not.toHaveBeenCalled();
});

it("preserves the already-existing response only for the current narrow linked grant", async () => {
  m.provider.accessUid = "existing";
  m.account = {
    uid: "existing",
    enabled: true,
    role: "SCOPED_PROVIDER",
    companyIds: ["allowed"],
  };
  await expect(createExpertAccount(admin, await input())).resolves.toEqual({
    created: false,
    alreadyExists: true,
    email: "expert@example.test",
  });
  expect(m.manage).not.toHaveBeenCalled();
});

it("ignores unreviewed role and company overrides from the caller", async () => {
  const body = { ...(await input()), role: "SUPER_ADMIN", companyIds: ["other"] };
  await createExpertAccount(admin, body);
  expect(m.manage.mock.calls[0][1]).toMatchObject({
    role: "SCOPED_PROVIDER",
    companyIds: ["allowed"],
  });
});

it("denies provider and non-security administrators before any reads", async () => {
  await expect(previewExpertAccount({ ...admin, role: "ADMIN" }, "provider")).rejects.toMatchObject(
    { status: 403 }
  );
  expect(m.collection).not.toHaveBeenCalled();
  expect(m.preview).not.toHaveBeenCalled();
});

it("only offers valid, current providers with existing client units in the batch", async () => {
  const entries = [
    { id: "ready", data: { ...m.provider, active: true } },
    { id: "inactive", data: { ...m.provider, active: false } },
    { id: "placeholder", data: { ...m.provider, active: true, email: "seu@email.com.br" } },
    { id: "internal", data: { ...m.provider, active: true, email: "nextcon@nextconsaude.com.br" } },
    { id: "orphan", data: { ...m.provider, active: true, servedCompanies: ["missing"] } },
    { id: "deleted", data: { ...m.provider, active: true, isDeleted: true } },
  ];
  m.collection.mockImplementation((name: string) => ({
    doc: () => ({ get: async () => ({ data: () => m.adminProfile }) }),
    limit: () => ({
      get: async () => ({
        size: name === "providers" ? entries.length : 1,
        docs:
          name === "providers"
            ? entries.map((row) => ({ id: row.id, data: () => row.data }))
            : [{ id: "allowed", data: () => ({ name: "Empresa sintética" }) }],
      }),
    }),
  }));
  const result = await listExpertAccounts(admin);
  expect(result.providers.filter((p) => p.ready).map((p) => p.id)).toEqual(["ready"]);
  expect(result.providers.some((p) => p.id === "deleted")).toBe(false);
  expect(result.providers.filter((p) => !p.ready)).toHaveLength(4);
  expect(m.manage).not.toHaveBeenCalled();
});

it("does not expose the provider directory to non-security administrators", async () => {
  await expect(listExpertAccounts({ ...admin, role: "PROVIDER" })).rejects.toMatchObject({
    status: 403,
  });
  expect(m.collection).not.toHaveBeenCalled();
});

for (const mode of ["preview", "list"]) {
  it.each(["suspended", "deleted", "missing", "demoted"])(
    `withholds expert account ${mode} data if the administrator is %s during the query`,
    async (change) => {
      m.onDataRead.mockImplementation(() => {
        if (change === "missing") m.adminProfile = undefined;
        else
          m.adminProfile = {
            ...m.adminProfile,
            ...(change === "suspended" ? { accessEnabled: false } : {}),
            ...(change === "deleted" ? { isDeleted: true } : {}),
            ...(change === "demoted" ? { role: "ADMIN" } : {}),
          };
      });
      await expect(
        mode === "preview" ? previewExpertAccount(admin, "provider") : listExpertAccounts(admin)
      ).rejects.toMatchObject({ status: 403 });
      expect(m.manage).not.toHaveBeenCalled();
    }
  );
}
