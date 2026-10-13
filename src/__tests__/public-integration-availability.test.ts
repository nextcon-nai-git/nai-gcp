import { describe, expect, it, vi } from "vitest";

const initialize = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("No public database access");
  })
);
vi.mock("@/firebase/init", () => ({ initializeFirebase: initialize }));
vi.mock("@/firebase/admin", () => ({ getAdminFirestore: initialize }));

import { POST, OPTIONS as leadOptions } from "@/app/api/leads/route";
import { GET, OPTIONS as widgetOptions } from "@/app/api/nai-widget/route";

describe("Unconfigured public integrations", () => {
  it("does not consume or persist personal contact data and never confirms a lead", async () => {
    const request = new Request("https://nai.example/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Contato de teste",
        email: "teste@example.com",
        empresa: "Teste",
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      sucesso: false,
      codigo: "PUBLIC_INTEGRATION_UNAVAILABLE",
    });
    expect(request.bodyUsed).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
  });

  it("does not publish the internal avatar configuration", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.sucesso).toBe(false);
    expect(body).not.toHaveProperty("dados");
    expect(initialize).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("allows browsers to read the unavailable result through preflight", async () => {
    for (const options of [leadOptions, widgetOptions]) {
      const response = await options();
      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    }
  });
});
