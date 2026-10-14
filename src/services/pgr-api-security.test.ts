// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { firebaseConfig } from "@/firebase/config";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  verify: vi.fn(),
  prepare: vi.fn(),
  save: vi.fn(),
  companies: vi.fn(),
  records: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("firebase-admin/app-check", () => ({ getAppCheck: () => ({ verifyToken: mock.verify }) }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { runTransaction: mock.transaction } }));
vi.mock("@/services/pgr-workspace", () => ({
  preparePgrDraft: mock.prepare,
  savePgrDraft: mock.save,
  getPgrCompanies: mock.companies,
  getPgrRecords: mock.records,
}));
vi.mock("@/services/pgr-ai-provider", () => ({ getPgrAi: () => null }));
import { POST as analyze } from "@/app/api/pgr/analyze/route";
import { POST as save } from "@/app/api/pgr/save/route";
import { GET as records } from "@/app/api/pgr/records/route";
import { GET as tasks, PATCH as patchTask } from "@/app/api/pgr/tasks/route";
import { GET as risks } from "@/app/api/pgr/risks/route";
import { POST as agent } from "@/app/api/pgr/agent-review/route";
import { POST as naiAnalyze } from "@/app/api/nai-importa/analyze/route";
import { POST as naiSave } from "@/app/api/nai-importa/save/route";
import { GET as naiCompanies } from "@/app/api/nai-importa/companies/route";
import { GET as naiHistory } from "@/app/api/nai-importa/history/route";
import { GET as naiReview } from "@/app/api/nai-importa/agent-review/route";
const request = (path: string, method = "GET", body?: string, appToken?: string) =>
  new NextRequest("https://nai.local/api/pgr/" + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(appToken ? { "X-Firebase-AppCheck": appToken } : {}),
    },
    ...(body ? { body } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PGR_APP_CHECK_ENFORCE", "false");
  mock.auth.mockResolvedValue({
    uid: "operator",
    email: "",
    role: "ENGINEER",
    tenantId: null,
    permissions: [],
    servedCompanies: ["cetesb"],
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("APIs de PGR: autenticação, isolamento e App Check", () => {
  it("recusa chamadas anônimas antes de qualquer análise ou persistência", async () => {
    mock.auth.mockRejectedValue(new AuthError("Autenticação necessária", 401));
    for (const [handler, path, method] of [
      [analyze, "analyze", "POST"],
      [save, "save", "POST"],
      [records, "records", "GET"],
      [tasks, "tasks", "GET"],
      [risks, "risks", "GET"],
      [agent, "agent-review", "POST"],
      [naiAnalyze, "nai-analyze", "POST"],
      [naiSave, "nai-save", "POST"],
      [naiCompanies, "nai-companies", "GET"],
      [naiHistory, "nai-history", "GET"],
      [naiReview, "nai-review", "GET"],
    ] as const) {
      expect((await handler(request(path, method))).status).toBe(401);
    }
    expect(mock.prepare).not.toHaveBeenCalled();
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it("impede leitura e alteração de empresas fora da carteira do técnico", async () => {
    expect((await records(request("records?companyId=avp"))).status).toBe(403);
    expect((await tasks(request("tasks?companyId=avp"))).status).toBe(403);
    expect((await risks(request("risks?companyId=avp"))).status).toBe(403);
    expect(
      (
        await patchTask(
          request(
            "tasks",
            "PATCH",
            JSON.stringify({ companyId: "avp", taskId: "pgr_abcdef", patch: { status: "done" } })
          )
        )
      ).status
    ).toBe(403);
    expect(
      (
        await agent(
          request(
            "agent-review",
            "POST",
            JSON.stringify({ companyId: "avp", cardId: "a".repeat(64), role: "medico_trabalho" })
          )
        )
      ).status
    ).toBe(403);
    expect(mock.records).not.toHaveBeenCalled();
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it("não libera um visitante com cadastro preparado", async () => {
    mock.auth.mockResolvedValue({
      uid: "visitor",
      role: "GUEST",
      tenantId: "cetesb",
      servedCompanies: [],
    });
    expect((await analyze(request("analyze", "POST"))).status).toBe(403);
    expect(mock.prepare).not.toHaveBeenCalled();
  });
  it("exige token válido quando a aplicação do App Check é ativada", async () => {
    vi.stubEnv("PGR_APP_CHECK_ENFORCE", "true");
    expect((await records(request("records"))).status).toBe(403);
    expect(mock.companies).not.toHaveBeenCalled();
    mock.verify.mockRejectedValueOnce(new Error("invalid token"));
    expect((await records(request("records", "GET", undefined, "invalid"))).status).toBe(403);
    mock.verify.mockResolvedValueOnce({ appId: "foreign-app" });
    expect((await records(request("records", "GET", undefined, "foreign"))).status).toBe(403);
    mock.verify.mockResolvedValueOnce({ appId: firebaseConfig.appId });
    mock.companies.mockResolvedValue([
      { id: "cetesb", name: "CETESB", cnpj: "43.776.491/0001-70" },
    ]);
    expect((await records(request("records", "GET", undefined, "valid"))).status).toBe(200);
  });
  it("mantém o modo de monitoramento sem aceitar um token falsificado", async () => {
    mock.companies.mockResolvedValue([]);
    expect((await records(request("records"))).status).toBe(200);
    mock.verify.mockRejectedValueOnce(new Error("fake"));
    expect((await records(request("records", "GET", undefined, "fake"))).status).toBe(403);
  });

  it("NAI importa preserva a escolha explícita de cadastro de prestadores", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File(["%PDF-1.7\nsynthetic\n%%EOF"], "synthetic.pdf", { type: "application/pdf" })
    );
    form.set("draftId", "a".repeat(64));
    form.set("companyId", "cetesb");
    form.set("confirmed", "true");
    form.set("includeProviders", "false");
    mock.save.mockResolvedValue({ companyId: "cetesb", cardId: "a".repeat(64), providerCount: 0 });
    const response = await naiSave(
      new NextRequest("https://nai.local/api/nai-importa/save", { method: "POST", body: form })
    );
    expect(response.status).toBe(200);
    expect(mock.save).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "operator" }),
      expect.objectContaining({ confirmed: true, includeProviders: false }),
      expect.any(Uint8Array)
    );
  });
});
