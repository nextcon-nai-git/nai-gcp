// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
import type { EsocialMessageEvent } from "@/lib/esocial-messaging";
import { currentEventFixture } from "../../../tests/fixtures/esocial/current-events";
const m = vi.hoisted(() => ({
  collection: vi.fn(),
  transaction: vi.fn(),
  getAll: vi.fn(),
  file: vi.fn(),
  certificate: vi.fn(),
  certificateStatus: vi.fn(),
  sign: vi.fn(),
  send: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, runTransaction: m.transaction, getAll: m.getAll },
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: m.file }) }),
}));
vi.mock("./vault", () => ({
  esocialCertificateStatus: m.certificateStatus,
  loadEsocialCertificate: m.certificate,
}));
vi.mock("./certificate", async (original) => {
  const actual = await original<typeof import("./certificate")>();
  return {
    ...actual,
    signEsocialXml: (...args: Parameters<typeof actual.signEsocialXml>) => {
      m.sign();
      return actual.signEsocialXml(...args);
    },
  };
});
vi.mock("./transport", async (original) => ({
  ...(await original<typeof import("./transport")>()),
  sendEsocialBatch: m.send,
  queryEsocialBatch: m.query,
}));
import {
  downloadEsocialDocument,
  getEsocialWorkspace,
  mutateEsocialMessage,
  syncEsocialMessages,
} from "./messaging";
import { esocialHash } from "./records";
import { inspectPkcs12, type CertificateMaterial } from "./certificate";
import {
  makeSyntheticA1,
  SYNTHETIC_CNPJ,
  SYNTHETIC_PASSWORD,
  SYNTHETIC_PROTOCOL,
} from "./certificate.test-fixtures";
import { EsocialTransportError } from "./transport";

// Stateful emulator double: transactions serialize, roll back and reject reads after writes.
// No Google/eSocial endpoint, real certificate or client data is used in this suite.
type Data = Record<string, any>;
let db: Map<string, Data>,
  files: Map<string, Buffer>,
  queue: Promise<unknown>,
  material: CertificateMaterial;
const user: AuthContext = {
  uid: "operator",
  email: "operator@example.test",
  role: "SUPER_ADMIN",
  tenantId: null,
  servedCompanies: [],
  permissions: [],
};
const base = "clinic_portal_private/esocial-messaging";
const path = (id: string) => `${base}/events/${id}`;
const receipt = "1.1.0000000000000000001";
function snap(p: string): any {
  return {
    id: p.split("/").at(-1),
    ref: ref(p),
    exists: db.has(p),
    data: () => (db.has(p) ? structuredClone(db.get(p)) : undefined),
  };
}
function ref(p: string): any {
  return {
    path: p,
    id: p.split("/").at(-1),
    collection: (n: string) => query(`${p}/${n}`),
    get: async () => snap(p),
    set: async (d: Data, options?: { merge?: boolean }) => {
      db.set(p, structuredClone(options?.merge ? { ...db.get(p), ...d } : d));
    },
    update: async (d: Data) => {
      if (!db.has(p)) throw Error("Missing document");
      db.set(p, structuredClone({ ...db.get(p), ...d }));
    },
  };
}
function query(
  p: string,
  filters: Array<[string, string, unknown]> = [],
  take = Infinity,
  cursor = ""
): any {
  return {
    path: p,
    _query: true,
    doc: (id: string) => ref(`${p}/${id}`),
    where: (k: string, op: string, v: unknown) => query(p, [...filters, [k, op, v]], take, cursor),
    limit: (n: number) => query(p, filters, n, cursor),
    orderBy: () => query(p, filters, take, cursor),
    select: () => query(p, filters, take, cursor),
    startAfter: (id: string) => query(p, filters, take, id),
    get: async () => {
      const docs = [...db.keys()]
        .filter(
          (k) =>
            k.startsWith(`${p}/`) &&
            k.split("/").length === p.split("/").length + 1 &&
            k.split("/").at(-1)! > cursor
        )
        .filter((k) =>
          filters.every(([f, op, v]) =>
            op === "=="
              ? db.get(k)![f] === v
              : op === "in"
                ? (v as unknown[]).includes(db.get(k)![f])
                : op === "<="
                  ? db.get(k)![f] <= v!
                  : false
          )
        )
        .sort()
        .slice(0, take)
        .map(snap);
      return { docs, size: docs.length };
    },
  };
}
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  material = await inspectPkcs12(makeSyntheticA1().pfx, SYNTHETIC_PASSWORD);
});
afterAll(() => vi.useRealTimers());
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  db = new Map();
  files = new Map();
  queue = Promise.resolve();
  vi.stubEnv("ESOCIAL_SYNC_ENABLED", "true");
  vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "true");
  m.collection.mockImplementation(query);
  m.getAll.mockImplementation(async (...refs) => refs.map((r) => snap(r.path)));
  m.file.mockImplementation((p: string) => ({
    save: async (b: Buffer) => {
      files.set(p, Buffer.from(b));
    },
    download: async () => {
      if (!files.has(p)) throw Error("missing artifact");
      return [Buffer.from(files.get(p)!)];
    },
    getMetadata: async () => [{ size: files.get(p)?.length }],
  }));
  m.transaction.mockImplementation((fn) => {
    const run = queue.then(async () => {
      let writing = false;
      const writes: Array<() => void> = [];
      const write = (p: string, d: Data) => {
        writing = true;
        writes.push(() => db.set(p, structuredClone(d)));
      };
      const result = await fn({
        get: async (r: any) => {
          if (writing) throw Error("Read after write");
          return r._query ? r.get() : snap(r.path);
        },
        set: (r: any, d: Data) => write(r.path, d),
        create: (r: any, d: Data) => {
          if (db.has(r.path)) throw Error("Already exists");
          write(r.path, d);
        },
        update: (r: any, d: Data) => {
          if (!db.has(r.path)) throw Error("Missing document");
          write(r.path, { ...db.get(r.path), ...d });
        },
        delete: (r: any) => {
          writing = true;
          writes.push(() => db.delete(r.path));
        },
      });
      writes.forEach((commit) => commit());
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  });
  db.set("users/operator", { role: "SUPER_ADMIN", accessEnabled: true, servedCompanies: [] });
  db.set("companies/ONE", { active: true, name: "Cliente sintético", cnpj: "12345678000195" });
  db.set("companies/ONE/employees/E1", {
    name: "Trabalhador sintético",
    cpf: "12345678909",
    companyId: "ONE",
    status: "active",
  });
  db.set(`${base}/links/${esocialHash("ONE:E1")}`, {
    companyId: "ONE",
    employeeId: "E1",
    cpf: "12345678909",
    matricula: "SYNTHETIC-001",
    reference: "Folha sintética",
    confirmedAt: "2026-10-20T00:00:00Z",
    confirmedBy: "operator",
  });
  db.set(`${base}/settings/certificate`, { activeId: "cert1" });
  db.set(`${base}/certificates/cert1`, {
    active: true,
    registration: SYNTHETIC_CNPJ,
    validFrom: "2020-01-01T00:00:00Z",
    validUntil: "2099-01-01T00:00:00Z",
  });
  db.set(`${base}/grants/ONE`, {
    companyId: "ONE",
    granteeRegistration: SYNTHETIC_CNPJ,
    profiles: ["sst", "toxicology"],
    validFrom: "2026-01-01",
    validUntil: "2027-01-01",
    active: true,
    reference: "Procuração sintética",
    confirmedBy: "operator",
    confirmedAt: "2026-10-20T00:00:00Z",
    verification: "operator_confirmed",
  });
  m.certificate.mockResolvedValue({ id: "cert1", material });
  m.certificateStatus.mockResolvedValue({
    configured: true,
    localValid: true,
    vaultConfigured: true,
    id: "cert1",
    registration: SYNTHETIC_CNPJ,
  });
  m.send.mockResolvedValue({
    status: "accepted",
    code: "201",
    description: "Lote recebido",
    protocol: SYNTHETIC_PROTOCOL,
    issues: [],
    rawResponse: "<synthetic-batch/>",
  });
  m.query.mockImplementation(async (input) => ({
    status: "completed",
    protocol: input.protocol,
    code: "201",
    description: "Processado",
    issues: [],
    rawResponse: "<synthetic-result/>",
    events: [
      {
        eventId: input.eventId,
        status: "accepted",
        code: "201",
        description: "Aceito",
        receipt,
        issues: [],
      },
    ],
  }));
});
async function mutate(input: unknown, actor = user): Promise<EsocialMessageEvent> {
  const response = await mutateEsocialMessage(actor, input);
  if (!("event" in response) || !response.event) throw Error("Expected event");
  return response.event;
}
const prepare = (payload = currentEventFixture("S2220")) =>
  mutate({
    action: "prepare",
    companyId: "ONE",
    payload,
    sourceReference: "Documento sintético conferido",
  });
const operation = (e: EsocialMessageEvent, action: string, actor = user) =>
  mutate({ action, id: e.id, version: e.version, confirmed: true }, actor);
const approve = (e: EsocialMessageEvent) =>
  mutate({
    action: "authorize",
    id: e.id,
    version: e.version,
    identityConfirmed: true,
    documentChecked: true,
  });
const submit = async () => operation(await approve(await prepare()), "transmit");
const accepted = async () => operation(await submit(), "query");

describe("mensageria: revisão, isolamento e idempotência", () => {
  it.each([undefined, "false", "TRUE"])(
    "bloqueia envio antes de ler A1, assinar ou reservar quando a configuração é %s",
    async (value) => {
      vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", value);
      const event = await approve(await prepare());
      const savedEvent = structuredClone(db.get(path(event.id)));
      const savedFiles = new Map(files);
      m.transaction.mockClear();
      m.certificate.mockClear();
      await expect(operation(event, "transmit")).rejects.toMatchObject({ status: 503 });
      expect(m.certificate).not.toHaveBeenCalled();
      expect(m.transaction).not.toHaveBeenCalled();
      expect(m.send).not.toHaveBeenCalled();
      expect(db.get(path(event.id))).toEqual(savedEvent);
      expect(files).toEqual(savedFiles);
    }
  );
  it("bloqueia recuperação de envio incerto sem alterar a tentativa anterior", async () => {
    m.send.mockRejectedValueOnce(new Error("synthetic timeout"));
    const event = await submit();
    expect(event.status).toBe("uncertain");
    const savedEvent = structuredClone(db.get(path(event.id)));
    vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "false");
    m.certificate.mockClear();
    m.transaction.mockClear();
    await expect(operation(event, "recover")).rejects.toMatchObject({ status: 503 });
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.certificate).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
    expect(db.get(path(event.id))).toEqual(savedEvent);
  });
  it("consulta lotes existentes pelo agendador com novas transmissões desligadas", async () => {
    const event = await submit();
    db.get(path(event.id))!.nextPollAt = "2026-11-01T11:59:00Z";
    vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "false");
    expect(await syncEsocialMessages()).toEqual({ checked: 1, waiting: 0, unavailable: 0 });
    expect(m.query).toHaveBeenCalledTimes(1);
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(db.get(path(event.id))!.status).toBe("accepted");
    expect(db.get(path(event.id))!.receipt).toBe(receipt);
  });
  it.each([
    ["timeout", "processing"],
    ["RESPONSE_DIGEST_MISMATCH", "uncertain"],
  ])("registra indisponibilidade tratada na consulta automática: %s", async (code, status) => {
    const event = await submit();
    const stored = db.get(path(event.id))!;
    stored.nextPollAt = "2026-11-01T11:59:00Z";
    const signed = stored.artifacts.signed;
    vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "false");
    m.sign.mockClear();
    m.query.mockRejectedValueOnce(
      code === "timeout"
        ? new Error("synthetic timeout")
        : new EsocialTransportError(code, "Synthetic mismatch")
    );
    expect(await syncEsocialMessages()).toEqual({ checked: 1, waiting: 0, unavailable: 1 });
    expect(db.get(path(event.id))).toMatchObject({
      status,
      protocol: event.protocol,
      artifacts: { signed },
    });
    expect(db.get(`${base}/settings/queryMonitor`)).toMatchObject({
      checked: 1,
      waiting: 0,
      unavailable: 1,
    });
    expect(m.query).toHaveBeenCalledOnce();
    expect(m.sign).not.toHaveBeenCalled();
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("conta processamento normal como pendente sem herdar erro da tentativa anterior", async () => {
    const event = await submit();
    const stored = db.get(path(event.id))!;
    stored.nextPollAt = "2026-11-01T11:59:00Z";
    stored.queryFailures = 2;
    stored.issues = [{ code: "QUERY_UNAVAILABLE", description: "Falha anterior sintética" }];
    m.query.mockResolvedValueOnce({
      status: "processing",
      protocol: event.protocol,
      code: "101",
      description: "Em processamento",
      issues: [],
      events: [],
      rawResponse: "<synthetic-pending/>",
    });
    expect(await syncEsocialMessages()).toEqual({ checked: 1, waiting: 1, unavailable: 0 });
    expect(db.get(path(event.id))).toMatchObject({ status: "processing", queryFailures: 0 });
    expect(db.get(path(event.id))!.receipt).toBeUndefined();
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it.each(["query", "batch"])("distingue rejeição da consulta e do lote: %s", async (scope) => {
    const event = await submit();
    db.get(path(event.id))!.nextPollAt = "2026-11-01T11:59:00Z";
    m.query.mockResolvedValueOnce({
      status: "rejected",
      rejectionScope: scope,
      protocol: event.protocol,
      code: scope === "query" ? "501" : "401",
      description: "Rejeição sintética",
      issues: [],
      events: [],
      rawResponse: "<synthetic-rejection/>",
    });
    expect(await syncEsocialMessages()).toEqual({
      checked: 1,
      waiting: 0,
      unavailable: scope === "query" ? 1 : 0,
    });
    expect(db.get(path(event.id))!.status).toBe(scope === "query" ? "processing" : "rejected");
    expect(db.get(path(event.id))!.receipt).toBeUndefined();
  });
  it("não confirma consulta concluída sem o recibo exigido", async () => {
    const event = await submit();
    db.get(path(event.id))!.nextPollAt = "2026-11-01T11:59:00Z";
    m.query.mockResolvedValueOnce({
      status: "completed",
      protocol: event.protocol,
      code: "201",
      description: "Resposta sintética incompleta",
      issues: [],
      events: [
        {
          eventId: event.eventId,
          status: "accepted",
          code: "201",
          description: "Sem recibo",
          issues: [],
        },
      ],
      rawResponse: "<synthetic-incomplete/>",
    });
    expect(await syncEsocialMessages()).toEqual({ checked: 1, waiting: 0, unavailable: 1 });
    expect(db.get(path(event.id))!.status).toBe("processing");
    expect(db.get(path(event.id))!.receipt).toBeUndefined();
  });
  it("preserva recibo concorrente e registra resultado não confirmado para a própria tentativa", async () => {
    const event = await submit();
    db.get(path(event.id))!.nextPollAt = "2026-11-01T11:59:00Z";
    const actualQuery = m.query.getMockImplementation()!;
    m.query.mockImplementationOnce(async (input) => {
      const current = db.get(path(event.id))!;
      current.status = "accepted";
      current.receipt = receipt;
      current.version++;
      delete current.queryLease;
      delete current.nextPollAt;
      return actualQuery(input);
    });
    expect(await syncEsocialMessages()).toEqual({ checked: 1, waiting: 0, unavailable: 1 });
    expect(db.get(path(event.id))).toMatchObject({ status: "accepted", receipt });
    expect(m.query).toHaveBeenCalledOnce();
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("envio interrompido sem resposta exige conferência e não vira consulta bem-sucedida", async () => {
    const event = await submit();
    const stored = db.get(path(event.id))!;
    stored.status = "submitting";
    stored.nextPollAt = "2026-11-01T11:59:00Z";
    delete stored.protocol;
    delete db.get(`${path(event.id)}/attempts/${stored.submission.id}`)!.response;
    vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "false");
    expect(await syncEsocialMessages()).toEqual({ checked: 0, waiting: 0, unavailable: 1 });
    expect(db.get(path(event.id))!.status).toBe("uncertain");
    expect(db.get(path(event.id))!.nextPollAt).toBeUndefined();
    expect(m.query).not.toHaveBeenCalled();
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["accepted", "processing", 1, 0],
    ["rejected", "rejected", 0, 0],
    ["uncertain", "uncertain", 0, 1],
  ])(
    "classifica recuperação da resposta preservada de envio: %s",
    async (status, expected, waiting, unavailable) => {
      const event = await submit();
      const stored = db.get(path(event.id))!;
      stored.status = "submitting";
      stored.nextPollAt = "2026-11-01T11:59:00Z";
      delete stored.protocol;
      const attempt = db.get(`${path(event.id)}/attempts/${stored.submission.id}`)!;
      attempt.response = {
        status,
        code: "SYNTHETIC",
        description: "Resposta preservada sintética",
        issues: [],
        ...(status === "accepted" ? { protocol: SYNTHETIC_PROTOCOL } : {}),
      };
      vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "false");
      expect(await syncEsocialMessages()).toEqual({ checked: 0, waiting, unavailable });
      expect(db.get(path(event.id))!.status).toBe(expected);
      expect(db.get(path(event.id))!.history.at(-1).action).toBe("submission_result");
      expect(m.query).not.toHaveBeenCalled();
      expect(m.send).toHaveBeenCalledTimes(1);
    }
  );
  it("prepara e aprova sem A1; nenhuma transmissão ocorre até a ação explícita", async () => {
    m.certificate.mockRejectedValue(new Error("A1 ausente"));
    const event = await approve(await prepare());
    expect(event.status).toBe("approved");
    expect(m.send).not.toHaveBeenCalled();
    await expect(operation(event, "transmit")).rejects.toThrow("A1 ausente");
    expect(m.send).not.toHaveBeenCalled();
  });
  it("trata duas importações da mesma ocorrência como um único rascunho", async () => {
    const [a, b] = await Promise.all([prepare(), prepare()]);
    expect(a.id).toBe(b.id);
    const changed = currentEventFixture("S2220");
    changed.aso.medico.nrCrm = "54321";
    await expect(prepare(changed)).rejects.toThrow("Já existe evento");
  });
  it("bloqueia uma colisão de Id oficial, mesmo quando a ocorrência é diferente", async () => {
    const fileFactory = m.file.getMockImplementation()!;
    m.file.mockImplementationOnce((p: string) => {
      const file = fileFactory(p);
      return {
        ...file,
        save: async (bytes: Buffer) => {
          await file.save(bytes);
          const eventId = bytes.toString().match(/ Id="([^"]+)"/)?.[1];
          if (!eventId) throw Error("Missing synthetic event Id");
          db.set(`${base}/eventIds/${esocialHash(`restricted:${eventId}`)}`, {
            localId: "another-reserved-event",
          });
        },
      };
    });
    await expect(prepare()).rejects.toThrow("identificador");
    expect([...db.keys()].filter((key) => key.startsWith(`${base}/events/`))).toHaveLength(0);
    expect(m.send).not.toHaveBeenCalled();
  });
  it("recusa CPF/vínculo de outro cliente e matrícula aproximada", async () => {
    const payload = currentEventFixture("S2220");
    payload.ideVinculo.matricula = "SYNTHETIC-002";
    await expect(prepare(payload)).rejects.toThrow(/matrícula|vínculo/i);
    const outsider: AuthContext = { ...user, role: "OPERATIONS", servedCompanies: ["TWO"] };
    await expect(
      mutate(
        { action: "prepare", companyId: "ONE", payload, sourceReference: "sintético" },
        outsider
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(m.send).not.toHaveBeenCalled();
  });
  it("recusa operador suspenso na transação, mesmo com token previamente aceito", async () => {
    const draft = await prepare();
    db.get("users/operator")!.accessEnabled = false;
    await expect(approve(draft)).rejects.toMatchObject({ status: 403 });
    expect(m.send).not.toHaveBeenCalled();
  });
  it("aprovação exige identidade e documento conferidos", async () => {
    const draft = await prepare();
    await expect(
      mutate({ action: "authorize", id: draft.id, version: draft.version, confirmed: true })
    ).rejects.toThrow("Confirme");
    await expect(operation(draft, "transmit")).rejects.toThrow("aprove");
  });
  it("não permite editar aprovados nem enviar após mudança da matrícula", async () => {
    const event = await approve(await prepare());
    await expect(
      mutate({
        action: "update",
        id: event.id,
        version: event.version,
        payload: event.payload,
        sourceReference: "conferido",
      })
    ).rejects.toThrow("editados");
    db.get(`${base}/links/${esocialHash("ONE:E1")}`)!.matricula = "ALTERADA";
    await expect(operation(event, "transmit")).rejects.toThrow(/matrícula|vínculo/);
    expect(m.send).not.toHaveBeenCalled();
  });
  it("reserva antes da rede e impede dois cliques simultâneos de transmitirem duas vezes", async () => {
    const event = await approve(await prepare());
    const results = await Promise.allSettled([
      operation(event, "transmit"),
      operation(event, "transmit"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(m.send).toHaveBeenCalledTimes(1);
    const value = db.get(path(event.id))!;
    expect(value.status).toBe("processing");
    expect(value.receipt).toBeUndefined();
    expect(m.send.mock.calls[0][0].signedXml).toContain("<Signature");
    expect(m.send.mock.calls[0][0].signedXml).toContain("<X509Certificate>");
  });
  it("revalida antes de assinar se o operador perde acesso durante a preparação do XML", async () => {
    const event = await approve(await prepare());
    const stored = structuredClone(db.get(path(event.id)));
    const originalFiles = new Map(files);
    const unsignedPath = stored!.artifacts.unsigned.path;
    const fileFactory = m.file.getMockImplementation()!;
    m.file.mockImplementation((objectPath: string) => {
      const file = fileFactory(objectPath);
      return {
        ...file,
        download: async (...args: unknown[]) => {
          const bytes = await file.download(...args);
          if (objectPath === unsignedPath) db.get("users/operator")!.accessEnabled = false;
          return bytes;
        },
      };
    });
    m.transaction.mockClear();
    await expect(operation(event, "transmit")).rejects.toMatchObject({ status: 403 });
    expect(m.certificate).toHaveBeenCalledTimes(1);
    expect(m.sign).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
    expect(db.get(path(event.id))).toEqual(stored);
    expect(files).toEqual(originalFiles);
  });
  it("não libera produção só porque existe A1 e procuração", async () => {
    const payload = currentEventFixture("S2220");
    payload.ideEvento.tpAmb = 1;
    await expect(operation(await approve(await prepare(payload)), "transmit")).rejects.toThrow(
      "Produção exige"
    );
    expect(m.send).not.toHaveBeenCalled();
  });
  it("nega procuração vencida e exige perfil toxicológico específico", async () => {
    const event = await approve(await prepare(currentEventFixture("S2221")));
    db.get(`${base}/grants/ONE`)!.profiles = ["sst"];
    await expect(operation(event, "transmit")).rejects.toThrow("procuração");
    db.get(`${base}/grants/ONE`)!.profiles = ["toxicology"];
    db.get(`${base}/grants/ONE`)!.validUntil = "2026-10-30";
    await expect(operation(event, "transmit")).rejects.toThrow("procuração");
    expect(m.send).not.toHaveBeenCalled();
  });
  it("nega leitura/download fora da carteira e só retorna campos públicos autorizados", async () => {
    const event = await submit();
    const workspace = await getEsocialWorkspace(user, { id: event.id });
    expect(JSON.stringify(workspace)).not.toMatch(
      /privateKeyPem|secretVersion|esocial-private|identityFingerprint|queryLease/
    );
    const outsider: AuthContext = { ...user, role: "OPERATIONS", servedCompanies: ["TWO"] };
    await expect(downloadEsocialDocument(outsider, event.id, "signed")).rejects.toMatchObject({
      status: 403,
    });
    expect((await downloadEsocialDocument(user, event.id, "signed")).xml).toContain("Signature");
  });
  it("verifica o hash do XML aprovado antes de assinar", async () => {
    const event = await approve(await prepare()),
      object = db.get(path(event.id))!.artifacts.unsigned;
    files.set(object.path, Buffer.from("<altered/>"));
    await expect(operation(event, "transmit")).rejects.toThrow(/divergente|Integridade/);
    expect(m.send).not.toHaveBeenCalled();
  });
});

describe("recibos, recuperação e retificações", () => {
  it("recusa consulta por operador revogado antes de abrir o A1", async () => {
    const event = await submit();
    const stored = structuredClone(db.get(path(event.id)));
    db.get("users/operator")!.accessEnabled = false;
    m.certificate.mockClear();
    m.transaction.mockClear();
    await expect(operation(event, "query")).rejects.toMatchObject({ status: 403 });
    expect(m.certificate).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.query).not.toHaveBeenCalled();
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(db.get(path(event.id))).toEqual(stored);
  });
  it.each(["query", "recover"])(
    "recusa resposta armazenada na ação %s se o perfil foi revogado",
    async (action) => {
      const event = await submit();
      const stored = db.get(path(event.id))!;
      stored.status = "uncertain";
      delete stored.protocol;
      db.get(`${path(event.id)}/attempts/${stored.submission.id}`)!.response = {
        status: "rejected",
        code: "400",
        description: "Resposta sintética",
        issues: [],
      };
      const before = structuredClone(stored);
      db.get("users/operator")!.accessEnabled = false;
      m.certificate.mockClear();
      m.transaction.mockClear();
      await expect(operation(event, action)).rejects.toMatchObject({ status: 403 });
      expect(m.certificate).not.toHaveBeenCalled();
      expect(m.transaction).not.toHaveBeenCalled();
      expect(m.query).not.toHaveBeenCalled();
      expect(m.send).toHaveBeenCalledTimes(1);
      expect(db.get(path(event.id))).toEqual(before);
    }
  );
  it.each(["query", "recover"])(
    "revalida o operador dentro do commit manual de resposta armazenada em %s",
    async (action) => {
      const event = await submit();
      const stored = db.get(path(event.id))!;
      stored.status = "uncertain";
      delete stored.protocol;
      db.get(`${path(event.id)}/attempts/${stored.submission.id}`)!.response = {
        status: "rejected",
        code: "400",
        description: "Resposta sintética",
        issues: [],
      };
      const before = structuredClone(stored);
      const transaction = m.transaction.getMockImplementation()!;
      m.certificate.mockClear();
      m.transaction.mockImplementationOnce((run) => {
        db.get("users/operator")!.accessEnabled = false;
        return transaction(run);
      });
      await expect(operation(event, action)).rejects.toMatchObject({ status: 403 });
      expect(m.certificate).not.toHaveBeenCalled();
      expect(m.query).not.toHaveBeenCalled();
      expect(m.send).toHaveBeenCalledTimes(1);
      expect(db.get(path(event.id))).toEqual(before);
    }
  );
  it("preserva protocolo recebido de POST legítimo mesmo se o operador for revogado durante a rede", async () => {
    const send = m.send.getMockImplementation()!;
    m.send.mockImplementationOnce(async (input) => {
      const response = await send(input);
      db.get("users/operator")!.accessEnabled = false;
      return response;
    });
    const result = await submit();
    expect(result.status).toBe("processing");
    expect(result.protocol).toBe(SYNTHETIC_PROTOCOL);
    const stored = db.get(path(result.id))!;
    expect(db.get(`${path(result.id)}/attempts/${stored.submission.id}`)?.response.protocol).toBe(
      SYNTHETIC_PROTOCOL
    );
    expect(m.send).toHaveBeenCalledTimes(1);
    m.certificate.mockClear();
    await expect(operation(result, "query")).rejects.toMatchObject({ status: 403 });
    expect(m.certificate).not.toHaveBeenCalled();
    expect(m.query).not.toHaveBeenCalled();
  });
  it("preserva recibo de consulta iniciada legitimamente após revogação durante a rede", async () => {
    const event = await submit();
    const query = m.query.getMockImplementation()!;
    m.query.mockImplementationOnce(async (input) => {
      const response = await query(input);
      db.get("users/operator")!.accessEnabled = false;
      return response;
    });
    const result = await operation(event, "query");
    expect(result.status).toBe("accepted");
    expect(result.receipt).toBe(receipt);
    expect(db.get(path(event.id))?.receipt).toBe(receipt);
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.query).toHaveBeenCalledTimes(1);
  });
  it("só aceita após recibo correlacionado ao Id; protocolo não encerra o evento", async () => {
    const event = await submit();
    expect(event.status).toBe("processing");
    expect(event.receipt).toBeUndefined();
    const result = await operation(event, "query");
    expect(result.status).toBe("accepted");
    expect(result.receipt).toBe(receipt);
    expect(result.businessValidation).toBe("ACCEPTED_BY_ESOCIAL");
  });
  it.each(["wrong-id", "missing-receipt"])("mantém pendente um retorno %s", async (scenario) => {
    const event = await submit();
    m.query.mockResolvedValue({
      status: "completed",
      protocol: event.protocol,
      code: "201",
      description: "Processado",
      rawResponse: "<synthetic/>",
      issues: [],
      events: [
        {
          eventId: scenario === "wrong-id" ? "OTHER" : event.eventId,
          status: "accepted",
          code: "201",
          description: "Aceito",
          receipt: scenario === "missing-receipt" ? undefined : receipt,
          issues: [],
        },
      ],
    });
    expect((await operation(event, "query")).status).toBe("processing");
  });
  it("erro da consulta não é rejeição do evento", async () => {
    const event = await submit();
    m.query.mockResolvedValue({
      status: "rejected",
      rejectionScope: "query",
      protocol: event.protocol,
      code: "403",
      description: "Consulta indisponível",
      issues: [],
      events: [],
      rawResponse: "<synthetic/>",
    });
    expect((await operation(event, "query")).status).toBe("processing");
  });
  it("timeout de consulta preserva protocolo e agenda nova consulta", async () => {
    const event = await submit();
    m.query.mockRejectedValue(new Error("timeout"));
    const result = await operation(event, "query");
    expect(result.status).toBe("processing");
    expect(result.protocol).toBe(event.protocol);
    expect(result.nextPollAt).toBeTruthy();
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("hash de recibo divergente interrompe consulta automática e exige conferência", async () => {
    const event = await submit();
    m.query.mockRejectedValue(
      new EsocialTransportError("RESPONSE_DIGEST_MISMATCH", "Synthetic mismatch")
    );
    const result = await operation(event, "query");
    expect(result.status).toBe("uncertain");
    expect(result.protocol).toBe(event.protocol);
    expect(result.nextPollAt).toBeUndefined();
    await syncEsocialMessages();
    expect(m.query).toHaveBeenCalledTimes(1);
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("mudança do término de um mesmo afastamento não cria segundo original", async () => {
    const payload = currentEventFixture("S2230");
    await prepare(payload);
    payload.infoAfastamento.fimAfastamento.dtTermAfast = "2026-10-23";
    await expect(prepare(payload)).rejects.toThrow("Já existe evento");
  });
  it("timeout de envio fica incerto e nunca é reenviado pelo agendador", async () => {
    m.send.mockRejectedValue(new Error("socket timeout"));
    const event = await submit();
    expect(event.status).toBe("uncertain");
    await syncEsocialMessages();
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.query).not.toHaveBeenCalled();
    await expect(operation(event, "transmit")).rejects.toThrow("aprove");
  });
  it("recuperação explícita usa exatamente o mesmo XML assinado e Id", async () => {
    m.send.mockResolvedValueOnce({
      status: "uncertain",
      code: "TIMEOUT",
      description: "Sem confirmação",
      issues: [],
    });
    const event = await submit();
    // A recorded uncertain result is not a protocol. Explicit recovery must retry the exact event.
    const result = await operation(event, "recover");
    expect(result.eventId).toBe(event.eventId);
    expect(m.send).toHaveBeenCalledTimes(2);
    expect(m.send.mock.calls[1][0].signedXml).toBe(m.send.mock.calls[0][0].signedXml);
  });
  it("recupera protocolo salvo após falha no commit sem novo envio", async () => {
    const event = await approve(await prepare()),
      transaction = m.transaction.getMockImplementation()!;
    m.transaction
      .mockImplementationOnce(transaction)
      .mockRejectedValueOnce(new Error("Synthetic aggregate commit failure"));
    await expect(operation(event, "transmit")).rejects.toThrow("Synthetic aggregate");
    const state = await getEsocialWorkspace(user, { id: event.id });
    if (!("event" in state) || !state.event) throw Error("Missing saved event");
    expect(state.event.status).toBe("submitting");
    expect((await operation(state.event, "query")).status).toBe("accepted");
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("interrupção sem resposta sai de submitting após a reserva vencer, sem reenviar", async () => {
    const event = await submit(),
      stored = db.get(path(event.id))!;
    stored.status = "submitting";
    delete stored.protocol;
    stored.submission.startedAt = "2026-11-01T11:55:00Z";
    delete db.get(`${path(event.id)}/attempts/${stored.submission.id}`)!.response;
    expect((await operation(event, "query")).status).toBe("uncertain");
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.query).not.toHaveBeenCalled();
  });
  it("recibo restrito só libera produção após ação explícita e para o mesmo tipo/certificado", async () => {
    const result = await accepted();
    await mutateEsocialMessage(user, {
      action: "enable_production",
      companyId: "ONE",
      confirmed: true,
    });
    const payload = currentEventFixture("S2220");
    payload.ideEvento.tpAmb = 1;
    const production = await operation(await approve(await prepare(payload)), "transmit");
    expect(production.status).toBe("processing");
    const cat = currentEventFixture("S2210");
    cat.ideEvento.tpAmb = 1;
    await expect(operation(await approve(await prepare(cat)), "transmit")).rejects.toThrow(
      "Produção exige"
    );
    expect(result.environment).toBe("restricted");
  });
  it("S3000 não exclui o original até o próprio recibo ser aceito", async () => {
    const original = await accepted(),
      draft = await operation(original, "exclude");
    expect(draft.previousId).toBe(original.id);
    expect(db.get(path(original.id))!.status).toBe("accepted");
    const sent = await operation(await approve(draft), "transmit");
    expect(db.get(path(original.id))!.status).toBe("accepted");
    await operation(sent, "query");
    expect(db.get(path(original.id))!.status).toBe("excluded");
  });
  it("retificação usa recibo original e só o substitui após aceite", async () => {
    const original = await accepted(),
      draft = await operation(original, "rectify");
    expect(draft.payload?.ideEvento).toMatchObject({ indRetif: 2, nrRecibo: receipt });
    await operation(await operation(await approve(draft), "transmit"), "query");
    expect(db.get(path(original.id))!.status).toBe("superseded");
  });
  it("exclusão não aceita troca de CPF ou tipo do original", async () => {
    const draft = await operation(await accepted(), "exclude");
    const payload = structuredClone(draft.payload!);
    (payload.ideVinculo as Data).cpfTrab = "52998224725";
    await expect(
      mutate({
        action: "update",
        id: draft.id,
        version: draft.version,
        payload,
        sourceReference: "Conferência",
      })
    ).rejects.toThrow("CPF e tipo");
  });
  it("exclui o recibo histórico mesmo após correção da matrícula da folha", async () => {
    const original = await accepted();
    db.get(`${base}/links/${esocialHash("ONE:E1")}`)!.matricula = "CORRECTED-CURRENT-LINK";
    const exclusion = await operation(original, "exclude");
    expect(exclusion.payload?.ideVinculo).toEqual({ cpfTrab: "12345678909" });
    await operation(await operation(await approve(exclusion), "transmit"), "query");
    expect(db.get(path(original.id))!.status).toBe("excluded");
  });
  it("exclusão usa fonte histórica e retificação exige o novo PDF conferido", async () => {
    const original = await accepted(),
      hash = "b".repeat(64);
    db.get(path(original.id))!.asoCardId = "card-synthetic";
    db.get(path(original.id))!.sourceDocumentHash = "a".repeat(64);
    db.set("clinic_portal_private/aso-flow/cases/card-synthetic", {
      id: "card-synthetic",
      version: 5,
      companyId: "ONE",
      employeeId: "E1",
      cnpj: "12345678000195",
      examType: "periodico",
      status: "reviewed",
      employeeIdentityHash: esocialHash(JSON.stringify(["ONE", "E1", "12345678909"])),
      aso: { hash, examDate: "2026-10-20" },
      review: {
        hash,
        identityConfirmed: true,
        documentChecked: true,
        reviewedAt: "2026-11-01T00:00:00Z",
        reviewedBy: "operator",
      },
    });
    const rectification = await operation(original, "rectify");
    expect(rectification.sourceDocumentHash).toBe(hash);
    const exclusion = await operation(original, "exclude");
    expect(exclusion.sourceDocumentHash).toBe("a".repeat(64));
    expect(db.get(path(original.id))!.status).toBe("accepted");
  });
  it("retificação avulsa não pode importar recibo de outro cliente", async () => {
    const payload = currentEventFixture("S2220");
    payload.ideEvento.indRetif = 2;
    payload.ideEvento.nrRecibo = receipt;
    await expect(prepare(payload)).rejects.toThrow("evento aceito");
    expect(m.send).not.toHaveBeenCalled();
  });
  it("cancelar não pode apagar uma transmissão pendente", async () => {
    await expect(operation(await submit(), "cancel")).rejects.toThrow("Cancelar rascunho");
  });
});
