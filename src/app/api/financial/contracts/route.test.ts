import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  profile: {} as Record<string, unknown>,
  verify: vi.fn(),
  readContracts: vi.fn(),
  company: vi.fn(),
  group: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { verifyIdToken: mocks.verify },
  adminDb: {
    collection: (name: string) =>
      name === "users"
        ? { doc: () => ({ get: async () => ({ exists: true, data: () => mocks.profile }) }) }
        : { doc: mocks.company },
    collectionGroup: mocks.group,
  },
}));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile = {
    role: "PROVIDER",
    companyId: "linked",
    servedCompanies: ["linked"],
    accessEnabled: true,
  };
  mocks.verify.mockResolvedValue({ uid: "provider", email: "synthetic@example.test" });
  mocks.readContracts.mockResolvedValue({ size: 0, docs: [] });
  const query = { limit: () => ({ get: mocks.readContracts }) };
  mocks.company.mockReturnValue({ collection: () => query });
  mocks.group.mockReturnValue(query);
});
const request = (company: string) =>
  new NextRequest(`https://nai.test/api/financial/contracts?company=${company}`, {
    headers: { authorization: "Bearer synthetic" },
  });
it.each(["PROVIDER", "SCOPED_PROVIDER"])(
  "denies contract summaries to %s before database reads",
  async (role) => {
    mocks.profile.role = role;
    for (const company of ["linked", "foreign", "all"]) {
      const result = await GET(request(company));
      expect(result.status).toBe(403);
      expect(await result.json()).not.toHaveProperty("contracts");
      expect(result.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mocks.company).not.toHaveBeenCalled();
    expect(mocks.group).not.toHaveBeenCalled();
    expect(mocks.readContracts).not.toHaveBeenCalled();
  }
);
it("preserves company-scoped contract access for the client administrator", async () => {
  mocks.profile.role = "CLIENT_ADMIN";
  expect((await GET(request("linked"))).status).toBe(200);
  expect(mocks.company).toHaveBeenCalledWith("linked");
  mocks.readContracts.mockClear();
  expect((await GET(request("foreign"))).status).toBe(403);
  expect(mocks.readContracts).not.toHaveBeenCalled();
  expect(mocks.group).not.toHaveBeenCalled();
});
it("preserves internal administration's portfolio query", async () => {
  mocks.profile = { role: "SUPER_ADMIN" };
  expect((await GET(request("all"))).status).toBe(200);
  expect(mocks.group).toHaveBeenCalledWith("contracts");
});
it("rejects expired authentication before reading contracts", async () => {
  mocks.verify.mockRejectedValueOnce(new Error("expired"));
  expect((await GET(request("linked"))).status).toBe(401);
  expect(mocks.readContracts).not.toHaveBeenCalled();
});
