import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unauthorized } from "@/lib/auth/errors";
const mock = vi.hoisted(() => ({ auth: vi.fn(), suggest: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: mock.auth,
  extractBearerToken: () => "test-token",
}));
vi.mock("@/ai/flows/suggest-exams-flow", () => ({ suggestExams: mock.suggest }));
import { POST } from "./route";
const request = (body: unknown) =>
  new NextRequest("https://nai.test/api/suggest-exams", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ role: "DOCTOR" });
  mock.suggest.mockResolvedValue({ recommendedExams: [] });
});
it("rejects unauthenticated requests before generation", async () => {
  mock.auth.mockRejectedValue(unauthorized());
  expect((await POST(request({}))).status).toBe(401);
  expect(mock.suggest).not.toHaveBeenCalled();
});
it("rejects profiles outside the clinical workflow", async () => {
  mock.auth.mockResolvedValue({ role: "HR" });
  expect((await POST(request({}))).status).toBe(403);
  expect(mock.suggest).not.toHaveBeenCalled();
});
it("requires actual age rather than assuming 30", async () => {
  expect(
    (await POST(request({ jobTitle: "Analista", companyRisks: ["Risco informado"] }))).status
  ).toBe(400);
  expect(mock.suggest).not.toHaveBeenCalled();
});
it("passes validated input and marks suggestions for medical review", async () => {
  const response = await POST(
    request({ jobTitle: "Analista", companyRisks: ["Risco informado"], age: 35 })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ requiresMedicalReview: true });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mock.suggest).toHaveBeenCalledWith({
    jobTitle: "Analista",
    companyRisks: ["Risco informado"],
    age: 35,
    idToken: "test-token",
  });
});
