import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  collection: vi.fn(),
  transaction: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  provider: {} as Record<string, unknown>,
  existing: null as Record<string, unknown> | null,
  changed: false,
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { getUserByEmail: m.getUser, createUser: m.createUser, updateUser: m.updateUser },
  adminDb: { collection: m.collection, runTransaction: m.transaction },
}));
import { createExpertAccount, previewExpertAccount } from "./expert-accounts";
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
  vi.clearAllMocks();
  m.changed = false;
  m.existing = null;
  m.provider = {
    name: "Perito sintético",
    email: "expert@example.test",
    servedCompanies: ["allowed"],
  };
  m.getUser.mockRejectedValue({ code: "auth/user-not-found" });
  m.createUser.mockResolvedValue({ uid: "new-expert" });
  m.updateUser.mockResolvedValue({});
  m.collection.mockImplementation((collection: string) => ({
    doc: (id = "audit") => ({
      collection,
      id,
      get: async () => ({
        exists: collection !== "users" || !!m.existing,
        data: () =>
          collection === "providers"
            ? m.provider
            : collection === "users"
              ? m.existing
              : { name: "Empresa sintética" },
      }),
    }),
  }));
  m.transaction.mockImplementation(async (fn) =>
    fn({
      get: async (ref: { collection: string; get: () => Promise<unknown> }) =>
        m.changed && ref.collection === "providers"
          ? { exists: true, data: () => ({ ...m.provider, servedCompanies: ["other"] }) }
          : ref.get(),
      create: m.create,
      update: m.update,
    })
  );
});
const input = async () => ({
  providerId: "provider",
  revision: (await previewExpertAccount(admin, "provider")).revision,
  password: "Synthetic-test-only-42",
});
it("creates a disabled account first and enables only after the narrow profile and audit commit", async () => {
  const body = await input();
  await expect(createExpertAccount(admin, body)).resolves.toMatchObject({ created: true });
  expect(m.createUser).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
  const profile = m.create.mock.calls.find(([ref]) => ref.collection === "users")![1];
  expect(profile).toMatchObject({
    role: "SCOPED_PROVIDER",
    servedCompanies: ["allowed"],
    permissions: [],
    providerId: "provider",
  });
  expect(JSON.stringify(m.create.mock.calls)).not.toContain(body.password);
  expect(m.updateUser).toHaveBeenCalledWith("new-expert", { disabled: false });
  expect(m.transaction.mock.invocationCallOrder[0]).toBeLessThan(
    m.updateUser.mock.invocationCallOrder[0]
  );
});
it("never overwrites an existing account or resets its password", async () => {
  m.getUser.mockResolvedValue({ uid: "existing", disabled: false });
  m.existing = { role: "ADMIN" };
  await expect(createExpertAccount(admin, await input())).rejects.toMatchObject({ status: 409 });
  expect(m.createUser).not.toHaveBeenCalled();
  expect(m.updateUser).not.toHaveBeenCalled();
});
it("keeps a newly created account disabled if the association changes before commit", async () => {
  m.changed = true;
  await expect(createExpertAccount(admin, await input())).rejects.toMatchObject({ status: 409 });
  expect(m.updateUser).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it("denies provider and non-security administrators before any reads", async () => {
  await expect(previewExpertAccount({ ...admin, role: "ADMIN" }, "provider")).rejects.toMatchObject(
    { status: 403 }
  );
  expect(m.collection).not.toHaveBeenCalled();
});
