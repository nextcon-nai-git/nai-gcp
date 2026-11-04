import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/webhook-security-guard", () => ({
  validateWebhookTargetUrl: mocks.validate,
}));

vi.mock("@/services/webhooks/post-webhook", () => ({
  postWebhook: mocks.post,
}));

import { NotificationService } from "./notification-service";

const alert = {
  id: "alert-test",
  title: "ASO Vence em 5 dias",
  description: "Exame ocupacional",
  type: "aso_expiration" as const,
  severity: "critical" as const,
  employeeName: "Pessoa Teste",
  companyId: "company-test",
  dueDate: "2026-11-10",
  daysRemaining: 5,
};

describe("NotificationService webhook egress", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.validate.mockReset();
    mocks.post.mockReset();
  });

  it("blocks an unvalidated target before any network dispatch", async () => {
    mocks.validate.mockResolvedValue({
      valid: false,
      error: "private target",
    });
    const result = await NotificationService.sendWhatsAppAlert(
      alert,
      "41999990000",
      "https://127.0.0.1/internal"
    );
    expect(result).toMatchObject({
      success: false,
      status: "FAILED",
      error: "Destino de webhook inválido ou não autorizado.",
    });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("pins the validated IP and does not perform a second DNS resolution", async () => {
    mocks.validate.mockResolvedValue({
      valid: true,
      normalizedUrl: "https://hooks.example.test/whatsapp",
      resolvedIps: ["203.0.113.10"],
    });
    mocks.post.mockResolvedValue({ status: 202, ok: true });

    const result = await NotificationService.sendWhatsAppAlert(
      alert,
      "41999990000",
      "https://hooks.example.test/whatsapp"
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe("DISPATCHED_WEBHOOK");
    expect(result.messageId).toMatch(/^msg_[0-9a-f-]{36}$/i);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0][0]).toBe("https://hooks.example.test/whatsapp");
    expect(mocks.post.mock.calls[0][1]).toEqual(["203.0.113.10"]);
    expect(mocks.post.mock.calls[0][4]).toBe(10000);
  });

  it("passes the configured domain allowlist to validation", async () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_ALLOWED_DOMAINS", "example.com, hooks.partner.test ");
    mocks.validate.mockResolvedValue({
      valid: false,
      error: "not allowed",
    });
    await NotificationService.sendWhatsAppAlert(
      alert,
      "41999990000",
      "https://other.example/whatsapp"
    );
    expect(mocks.validate).toHaveBeenCalledWith("https://other.example/whatsapp", [
      "example.com",
      "hooks.partner.test",
    ]);
  });

  it("preserves the no-channel behavior without validating or dispatching", async () => {
    const result = await NotificationService.sendWhatsAppAlert(alert, "41999990000");
    expect(result.success).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(mocks.validate).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
