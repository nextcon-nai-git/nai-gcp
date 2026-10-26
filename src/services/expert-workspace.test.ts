import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  collection: vi.fn(),
  profile: {} as Record<string, unknown>,
  provider: {} as Record<string, unknown>,
  gets: [] as string[],
  profiles: 0,
  revoke: false,
}));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: m.collection } }));
import { readExpertWorkspace } from "./expert-workspace";
import type { AuthContext } from "@/lib/auth/auth-context";
const actor: AuthContext = {
  uid: "expert",
  email: "expert@example.test",
  role: "MEDICAL_EXPERT",
  tenantId: null,
  permissions: [],
  servedCompanies: ["allowed"],
};
beforeEach(() => {
  m.gets = [];
  m.profiles = 0;
  m.revoke = false;
  m.profile = {
    role: "MEDICAL_EXPERT",
    accessEnabled: true,
    providerId: "provider",
    servedCompanies: ["allowed", "stale"],
  };
  m.provider = { email: actor.email, accessUid: actor.uid, servedCompanies: ["allowed"] };
  m.collection.mockImplementation((collection: string) => ({
    doc: (id: string) => ({
      get: async () => {
        m.gets.push(`${collection}/${id}`);
        const data =
          collection === "users"
            ? ++m.profiles > 1 && m.revoke
              ? { ...m.profile, accessEnabled: false }
              : m.profile
            : collection === "providers"
              ? m.provider
              : { name: "Unidade sintética", cnpj: "123", contract: "private", billing: "private" };
        return { id, exists: true, data: () => data };
      },
      collection: () => ({
        limit: () => ({
          get: async () => ({
            size: 1,
            docs: [
              {
                id: "task",
                data: () => ({
                  companyId: "allowed",
                  title: "Card sintético",
                  status: "todo",
                  contract: "private",
                }),
              },
            ],
          }),
        }),
      }),
    }),
  }));
});
it("intersects the stored grant and current provider links, returning only projected data", async () => {
  const data = await readExpertWorkspace(actor, "allowed");
  expect(data.companies.map((c) => c.id)).toEqual(["allowed"]);
  expect(data.tasks.map((c) => c.title)).toEqual(["Card sintético"]);
  expect(JSON.stringify(data)).not.toContain("private");
  expect(m.gets).not.toContain("companies/stale");
});
it.each(["other", "stale", "all"])(
  "rejects an ungranted unit before any company query (%s)",
  async (id) => {
    await expect(readExpertWorkspace(actor, id)).rejects.toMatchObject({ status: 403 });
    expect(m.gets.some((p) => p.startsWith("companies/"))).toBe(false);
  }
);
it("rejects revocation during a read and a provider linked to someone else", async () => {
  m.revoke = true;
  await expect(readExpertWorkspace(actor, "allowed")).rejects.toMatchObject({ status: 403 });
  m.provider.accessUid = "other";
  await expect(readExpertWorkspace(actor, "allowed")).rejects.toMatchObject({ status: 403 });
});
