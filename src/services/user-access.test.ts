import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  create: vi.fn(),
  update: vi.fn(),
  revoke: vi.fn(),
  get: vi.fn(),
  byEmail: vi.fn(),
  reset: vi.fn(),
  failEnable: false,
  seq: 0,
}));
vi.mock("@/lib/firebase-admin", () => {
  const ref = (path: string) => ({
    path,
    get: async () => ({
      exists: m.rows.has(path),
      data: () => (m.rows.has(path) ? { ...m.rows.get(path) } : undefined),
    }),
  });
  const apply = (r: { path: string }, data: Record<string, unknown>) =>
    m.rows.set(r.path, { ...m.rows.get(r.path), ...data });
  return {
    adminAuth: {
      createUser: m.create,
      updateUser: m.update,
      revokeRefreshTokens: m.revoke,
      getUser: m.get,
      getUserByEmail: m.byEmail,
      generatePasswordResetLink: m.reset,
    },
    adminDb: {
      collection: (c: string) => ({
        doc: (id = String(++m.seq)) => ref(`${c}/${id}`),
        limit: () => ({
          get: async () => ({
            size: 2,
            docs: ["a", "b"].map((id) => ({ id, data: () => ({ name: id }) })),
          }),
        }),
        add: async (data: Record<string, unknown>) => {
          m.rows.set(`${c}/audit-${++m.seq}`, data);
        },
      }),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const writes: Array<() => unknown> = [];
        const result = await fn({
          get: (r: ReturnType<typeof ref>) => r.get(),
          set: (r: ReturnType<typeof ref>, d: Record<string, unknown>) =>
            writes.push(() => apply(r, d)),
          update: (r: ReturnType<typeof ref>, d: Record<string, unknown>) =>
            writes.push(() => {
              if ("accessOperationId" in d && typeof d.accessOperationId !== "string") {
                const copy = { ...d };
                delete copy.accessOperationId;
                delete m.rows.get(r.path)!.accessOperationId;
                return apply(r, copy);
              }
              return apply(r, d);
            }),
          create: (r: ReturnType<typeof ref>, d: Record<string, unknown>) =>
            writes.push(() => apply(r, d)),
        });
        writes.forEach((fn) => fn());
        return result;
      },
    },
  };
});
import { manageUserAccess, previewUserAccess } from "./user-access";
import type { AuthContext } from "@/lib/auth/auth-context";
const admin: AuthContext = {
  uid: "admin",
  email: "admin@example.test",
  role: "SUPER_ADMIN",
  tenantId: null,
  servedCompanies: [],
  permissions: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  m.rows.clear();
  m.seq = 0;
  m.rows.set("providers/p", {
    name: "Prestador teste",
    email: "provider@example.test",
    active: true,
    servedCompanies: ["a"],
  });
  m.rows.set("nxc_employees/e", {
    name: "Colaborador teste",
    email: "employee@example.test",
    status: "ATIVO",
  });
  m.rows.set("companies/a", { name: "A" });
  m.rows.set("companies/b", { name: "B" });
  m.byEmail.mockRejectedValue({ code: "auth/user-not-found" });
  m.create.mockResolvedValue({ uid: "new" });
  m.update.mockResolvedValue({});
  m.revoke.mockResolvedValue(undefined);
  m.get.mockResolvedValue({
    uid: "new",
    email: "provider@example.test",
    disabled: false,
    emailVerified: false,
    metadata: {},
  });
  m.reset.mockResolvedValue("https://auth.example.test/private-reset-link");
});
async function input(kind = "provider", id = "p", action = "create") {
  const p = await previewUserAccess(admin, kind, id);
  return {
    kind,
    id,
    action,
    revision: p.revision,
    role: "SCOPED_PROVIDER",
    companyIds: ["a"],
    password: "Synthetic-42",
  };
}
function existing(enabled = true) {
  Object.assign(m.rows.get("providers/p")!, { accessUid: "new" });
  m.rows.set("users/new", {
    providerId: "p",
    role: "SCOPED_PROVIDER",
    servedCompanies: ["a"],
    email: "provider@example.test",
    accessEnabled: enabled,
  });
  m.get.mockResolvedValue({
    uid: "new",
    email: "provider@example.test",
    disabled: !enabled,
    emailVerified: false,
    metadata: {},
  });
}
it.each(["ADMIN", "OPERATIONS", "SCOPED_PROVIDER", "GUEST"])(
  "denies %s management before Auth calls",
  async (role) => {
    await expect(manageUserAccess({ ...admin, role: role as never }, {})).rejects.toMatchObject({
      status: 403,
    });
    expect(m.create).not.toHaveBeenCalled();
  }
);
it("creates a disabled provider first, narrow profile and audit without secrets", async () => {
  const body = await input();
  await manageUserAccess(admin, body);
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
  expect(m.rows.get("users/new")).toMatchObject({
    role: "SCOPED_PROVIDER",
    providerId: "p",
    servedCompanies: ["a"],
    accessEnabled: true,
    permissions: [],
  });
  expect(m.revoke).toHaveBeenCalledWith("new");
  expect(JSON.stringify([...m.rows])).not.toContain(body.password);
  expect([...m.rows.values()].some((d) => d.phase === "COMPLETED")).toBe(true);
});
it("rejects grants outside provider assignments", async () => {
  await expect(
    manageUserAccess(admin, { ...(await input()), companyIds: ["b"] })
  ).rejects.toMatchObject({ status: 403 });
  expect(m.create).not.toHaveBeenCalled();
});
it("cannot promote a provider", async () => {
  await expect(
    manageUserAccess(admin, { ...(await input()), role: "ADMIN" })
  ).rejects.toMatchObject({ status: 403 });
});
it("rejects stale revisions and busy operations", async () => {
  const body = await input();
  m.rows.get("providers/p")!.email = "changed@example.test";
  await expect(manageUserAccess(admin, body)).rejects.toMatchObject({ status: 409 });
  const fresh = await input();
  m.rows.get("providers/p")!.accessOperationId = "other";
  await expect(manageUserAccess(admin, fresh)).rejects.toMatchObject({ status: 409 });
  expect(m.create).not.toHaveBeenCalled();
});
it("never adopts an existing identity", async () => {
  const body = await input();
  m.byEmail.mockResolvedValue({ uid: "unrelated" });
  await expect(manageUserAccess(admin, body)).rejects.toMatchObject({ status: 409 });
  expect(m.create).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});
it("suspends profiles and revokes sessions", async () => {
  existing();
  await manageUserAccess(admin, await input("provider", "p", "disable"));
  expect(m.rows.get("users/new")?.accessEnabled).toBe(false);
  expect(m.update).toHaveBeenCalledWith("new", { disabled: true });
  expect(m.update).not.toHaveBeenCalledWith("new", { disabled: false });
});
it("generates reset link without reactivating suspended accounts or persisting link", async () => {
  existing(false);
  const result = await manageUserAccess(admin, await input("provider", "p", "reset-password"));
  expect(result.resetLink).toContain("private-reset-link");
  expect(m.rows.get("users/new")?.accessEnabled).toBe(false);
  expect(m.update).not.toHaveBeenCalledWith("new", { disabled: false });
  expect(JSON.stringify([...m.rows])).not.toContain("private-reset-link");
});
it("keeps access denied if Auth fails to enable", async () => {
  m.update.mockImplementation(async (_uid, changes) => {
    if (changes.disabled === false) throw new Error("auth unavailable");
  });
  await expect(manageUserAccess(admin, await input())).rejects.toThrow("auth unavailable");
  expect(m.rows.get("users/new")?.accessEnabled).toBe(false);
});
it("refuses operations role with a misleading restricted-company selection", async () => {
  await expect(
    manageUserAccess(admin, { ...(await input("employee", "e")), role: "OPERATIONS" })
  ).rejects.toMatchObject({ status: 400 });
});
it("creates a scoped employee with no arbitrary permissions", async () => {
  await manageUserAccess(admin, {
    ...(await input("employee", "e")),
    role: "DOCTOR",
    permissions: ["*"],
  });
  expect(m.rows.get("users/new")).toMatchObject({
    role: "DOCTOR",
    employeeId: "e",
    companyId: "a",
    tenantId: "a",
    permissions: [],
  });
});
it("requires an active employee and rejects privileged roles", async () => {
  await expect(
    manageUserAccess(admin, { ...(await input("employee", "e")), role: "SUPER_ADMIN" })
  ).rejects.toMatchObject({ status: 400 });
  m.rows.get("nxc_employees/e")!.status = "INATIVO";
  await expect(
    manageUserAccess(admin, { ...(await input("employee", "e")), role: "DOCTOR" })
  ).rejects.toMatchObject({ status: 400 });
});
it("refuses cross-linked profiles", async () => {
  existing();
  m.rows.get("users/new")!.providerId = "other";
  await expect(
    manageUserAccess(admin, { kind: "provider", id: "p", action: "disable", revision: "old" })
  ).rejects.toMatchObject({ status: 409 });
  expect(m.update).not.toHaveBeenCalled();
});
it("updating grants preserves suspended status", async () => {
  existing(false);
  await manageUserAccess(admin, await input("provider", "p", "update"));
  expect(m.rows.get("users/new")?.accessEnabled).toBe(false);
  expect(m.update).not.toHaveBeenCalledWith("new", { disabled: false });
});
