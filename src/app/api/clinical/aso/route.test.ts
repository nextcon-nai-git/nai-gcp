// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  appCheck: vi.fn(),
  review: vi.fn(),
  complete: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/auth/require-pgr-app-check", () => ({ requirePgrAppCheck: m.appCheck }));
vi.mock("@/services/clinical-aso-completion", () => ({
  reviewClinicalAso: m.review,
  completeClinicalAppointmentWithAso: m.complete,
}));
import { POST } from "./route";

const actor = { uid: "synthetic-doctor", role: "DOCTOR" };
const complete = {
  action: "complete",
  companyId: "company-a",
  cardId: "a".repeat(64),
  employeeId: "employee-a",
  appointmentId: "appointment-a",
};
const request = (body: unknown) =>
  new NextRequest("https://nai.example.test/api/clinical/aso", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue(actor);
  m.appCheck.mockResolvedValue(undefined);
  m.review.mockResolvedValue({ status: "reviewed" });
  m.complete.mockResolvedValue({ status: "completed" });
});

describe("corpo limitado e respostas privadas para conferência clínica de ASO", () => {
  it.each([undefined, "1"])(
    "interrompe o stream acima de 4096 bytes mesmo com Content-Length %s",
    async (contentLength) => {
      const cancel = vi.fn();
      const req = new NextRequest("https://nai.example.test/api/clinical/aso", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(contentLength ? { "content-length": contentLength } : {}),
        },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(4096));
            controller.enqueue(new Uint8Array(1));
            // Deliberately stays open: the server must cancel at the byte limit.
          },
          cancel,
        }),
        duplex: "half",
      } as ConstructorParameters<typeof NextRequest>[1]);
      const response = await POST(req);
      expect(response.status).toBe(413);
      expect(response.headers.get("cache-control")).toContain("private, no-store");
      expect(cancel).toHaveBeenCalledOnce();
      expect(m.review).not.toHaveBeenCalled();
      expect(m.complete).not.toHaveBeenCalled();
    }
  );

  it.each(["auth", "appCheck"] as const)(
    "exige %s antes de consumir os dados clínicos",
    async (guard) => {
      m[guard].mockRejectedValue(new AuthError("Acesso revogado.", 403));
      const req = request(complete);
      const response = await POST(req);
      expect(response.status).toBe(403);
      expect(req.bodyUsed).toBe(false);
      expect(m.review).not.toHaveBeenCalled();
      expect(m.complete).not.toHaveBeenCalled();
    }
  );

  it("preserva conclusão válida dentro do limite e sem cache compartilhado", async () => {
    const response = await POST(request(complete));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "completed" });
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(m.complete).toHaveBeenCalledExactlyOnceWith(actor, complete);
    expect(m.review).not.toHaveBeenCalled();
  });

  it("preserva a conferência com o snapshot do atendimento", async () => {
    const review = {
      ...complete,
      action: "review",
      confirmedOriginal: true,
      appointmentSnapshot: {
        appointmentId: complete.appointmentId,
        companyId: complete.companyId,
        companyName: "Empresa de teste",
        employeeId: complete.employeeId,
        employeeName: "Pessoa de teste",
        type: "Periódico",
        dateTime: "2026-10-31T08:00:00",
      },
    };
    const response = await POST(request(review));
    expect(response.status).toBe(200);
    expect(m.review).toHaveBeenCalledExactlyOnceWith(actor, review);
    expect(m.complete).not.toHaveBeenCalled();
  });

  it("recusa JSON inválido sem executar a revisão ou conclusão", async () => {
    const req = new NextRequest("https://nai.example.test/api/clinical/aso", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect((await POST(req)).status).toBe(400);
    expect(m.review).not.toHaveBeenCalled();
    expect(m.complete).not.toHaveBeenCalled();
  });

  it("não transforma uma falha interna em sucesso nem expõe seu conteúdo", async () => {
    m.complete.mockRejectedValue(new Error("synthetic-private-document-details"));
    const response = await POST(request(complete));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(await response.text()).not.toContain("synthetic-private-document-details");
  });
});
