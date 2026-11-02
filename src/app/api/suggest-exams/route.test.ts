// @vitest-environment node
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
  const req = request({});
  expect((await POST(req)).status).toBe(401);
  expect(req.bodyUsed).toBe(false);
  expect(mock.suggest).not.toHaveBeenCalled();
});
it.each([undefined, "1"])(
  "cancels oversized streams with Content-Length %s before invoking the model",
  async (contentLength) => {
    const cancel = vi.fn();
    const req = new NextRequest("https://nai.test/api/suggest-exams", {
      method: "POST",
      headers: contentLength ? { "content-length": contentLength } : {},
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(120000));
          controller.enqueue(new Uint8Array(1));
        },
        cancel,
      }),
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    expect((await POST(req)).status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(mock.suggest).not.toHaveBeenCalled();
  }
);
it("preserves the existing character limit within the byte budget", async () => {
  const response = await POST(request({ jobTitle: "a".repeat(30001) }));
  expect(response.status).toBe(413);
  expect(mock.suggest).not.toHaveBeenCalled();
});
it("accepts valid multibyte clinical text within the previous limits", async () => {
  const body = {
    jobTitle: "Analista",
    companyRisks: Array.from({ length: 50 }, () => "漢".repeat(500)),
    age: 35,
  };
  expect(JSON.stringify(body).length).toBeLessThan(30000);
  expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(30000);
  expect((await POST(request(body))).status).toBe(200);
  expect(mock.suggest).toHaveBeenCalledWith({ ...body, idToken: "test-token" });
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
