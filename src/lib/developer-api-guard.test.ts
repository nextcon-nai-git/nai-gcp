import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  requireDeveloperPrincipal,
  requireApiKey,
  authenticateApiKeyRequest,
  handleApiGuardError,
  requireClient,
  requireScope,
} from "./developer-api-guard";
const state = vi.hoisted(() => ({
  get: vi.fn(),
  where: vi.fn(),
  select: vi.fn(),
  doc: vi.fn(),
  update: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({
      where(...args: unknown[]) {
        state.where(...args);
        return this;
      },
      select(...fields: string[]) {
        state.select(...fields);
        return this;
      },
      limit() {
        return this;
      },
      doc(id: string) {
        state.doc(id);
        return this;
      },
      get: state.get,
      update: state.update,
      add: state.add,
    }),
  },
}));
const request = () =>
  new NextRequest("https://example.test/api/pgr", {
    headers: { "x-api-key": "nai_live_synthetic_test" },
  });
const record = (stored: Record<string, unknown>, id = "snapshot-synthetic") =>
  state.get.mockResolvedValue({ empty: false, docs: [{ id, data: () => stored }] });
beforeEach(() => {
  vi.clearAllMocks();
});

describe("verificação M2M retorna identidade sem material de credencial", () => {
  it("consulta somente permissões necessárias e retorna um principal explícito", async () => {
    record({
      clientId: "a",
      scopes: ["pgr:read"],
      keyHash: "synthetic-private-hash",
      keyPrefix: "synthetic-prefix",
      rawKey: "synthetic-raw",
      unrelatedMetadata: "unrelated",
    });
    const principal = await requireDeveloperPrincipal(request());
    expect(principal).toEqual({ id: "snapshot-synthetic", clientId: "a", scopes: ["pgr:read"] });
    expect(Object.keys(principal).sort()).toEqual(["clientId", "id", "scopes"]);
    expect(state.select).toHaveBeenCalledWith("clientId", "scopes");
    expect(state.where).toHaveBeenCalledWith(
      "keyHash",
      "==",
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
    expect(state.where).toHaveBeenCalledWith("active", "==", true);
    expect(state.add).toHaveBeenCalledWith(
      expect.objectContaining({ keyId: "snapshot-synthetic", clientId: "a" })
    );
    expect(JSON.stringify(state.add.mock.calls)).not.toContain("synthetic-private-hash");
    expect(JSON.stringify(state.add.mock.calls)).not.toContain("synthetic-prefix");
    expect(() => requireScope(principal, "pgr:read")).not.toThrow();
    expect(() => requireScope(principal, "pgr:write")).toThrow("Escopo insuficiente");
    expect(() => requireClient(principal, "b")).toThrow("Isolamento Tenant");
  });
  it("um id armazenado falsificado não assume identidade nem autoria na auditoria", async () => {
    record(
      { id: "impersonated-other-document", clientId: "a", scopes: ["incidents:write"] },
      "authoritative-document-id"
    );
    const principal = await requireDeveloperPrincipal(request());
    expect(principal.id).toBe("authoritative-document-id");
    expect(state.doc).toHaveBeenCalledWith("authoritative-document-id");
    expect(state.add).toHaveBeenCalledWith(
      expect.objectContaining({ keyId: "authoritative-document-id" })
    );
    expect(JSON.stringify(state.add.mock.calls)).not.toContain("impersonated-other-document");
  });
  it("não inspeciona hash/prefixo ou propriedades extras ao construir a identidade", async () => {
    const stored = { clientId: "a", scopes: ["pgr:read"] };
    Object.defineProperty(stored, "keyHash", {
      enumerable: true,
      get() {
        throw new Error("credential material must not be read");
      },
    });
    record(stored);
    await expect(requireDeveloperPrincipal(request())).resolves.toHaveProperty("clientId", "a");
  });
  it("copia e congela a identidade e as permissões sem reter referências ao registro", async () => {
    const stored = { clientId: "a", scopes: ["pgr:read"] };
    record(stored);
    const principal = await requireDeveloperPrincipal(request());
    stored.clientId = "GLOBAL";
    stored.scopes.push("*");
    expect(principal.clientId).toBe("a");
    expect(principal.scopes).toEqual(["pgr:read"]);
    expect(Object.isFrozen(principal)).toBe(true);
    expect(Object.isFrozen(principal.scopes)).toBe(true);
    expect(Reflect.set(principal, "clientId", "GLOBAL")).toBe(false);
    expect(Reflect.set(principal.scopes, "0", "*")).toBe(false);
  });
  it("mantém compatibilidade dos wrappers sem devolver o documento da credencial", async () => {
    record({
      clientId: "a",
      scopes: ["pgr:read"],
      keyHash: "private-synthetic",
      keyPrefix: "prefix-synthetic",
    });
    expect(await requireApiKey(request())).toEqual({
      id: "snapshot-synthetic",
      clientId: "a",
      scopes: ["pgr:read"],
    });
    const result = await authenticateApiKeyRequest(request(), "pgr:read");
    expect(result.success).toBe(true);
    expect(result.keyRecord).toEqual({
      id: "snapshot-synthetic",
      clientId: "a",
      scopes: ["pgr:read"],
    });
    expect(JSON.stringify(result)).not.toContain("private-synthetic");
  });
  it.each([
    { scopes: ["*"] },
    { clientId: "  ", scopes: ["*"] },
    { clientId: "a", scopes: [123] },
    { clientId: "a", scopes: "*" },
  ])("nega registro inválido antes de auditar: %j", async (stored) => {
    record(stored);
    await expect(requireDeveloperPrincipal(request())).rejects.toThrow("sem vínculo");
    expect(state.update).not.toHaveBeenCalled();
    expect(state.add).not.toHaveBeenCalled();
  });
  it("nega credencial ausente ou revogada antes de entregar identidade", async () => {
    await expect(
      requireDeveloperPrincipal(new NextRequest("https://example.test"))
    ).rejects.toThrow("ausente ou inválida");
    expect(state.get).not.toHaveBeenCalled();
    state.get.mockResolvedValue({ empty: true, docs: [] });
    await expect(requireDeveloperPrincipal(request())).rejects.toThrow(
      "inexistente, inativa ou revogada"
    );
    expect(state.add).not.toHaveBeenCalled();
  });
  it("limita uso pelo ID real do documento mesmo se o campo id armazenado variar", async () => {
    for (let index = 0; index < 120; index++) {
      record(
        { id: `untrusted-${index}`, clientId: "a", scopes: ["pgr:read"] },
        "rate-limit-synthetic-document"
      );
      await requireDeveloperPrincipal(request());
    }
    record(
      { id: "another-untrusted-id", clientId: "a", scopes: ["pgr:read"] },
      "rate-limit-synthetic-document"
    );
    await expect(requireDeveloperPrincipal(request())).rejects.toMatchObject({ status: 429 });
    expect(state.add).toHaveBeenCalledTimes(120);
  });
  it("não retorna detalhes internos de infraestrutura ao cliente", async () => {
    const response = handleApiGuardError(new Error("private infrastructure detail"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private infrastructure detail");
  });
});
