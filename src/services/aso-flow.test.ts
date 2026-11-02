// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
import type { AsoFlowCard, AsoFlowRow } from "@/lib/aso-flow";

const m = vi.hoisted(() => ({ collection: vi.fn(), transaction: vi.fn(), file: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, runTransaction: m.transaction },
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: m.file }) }),
}));
import {
  getAsoFlowCard,
  importAsoFlowRows,
  listAsoFlowCards,
  listAsoFlowClinics,
  previewAsoFlowImport,
  readAsoFlowDocument,
  recordAsoFlowSent,
  reserveAsoFlowMail,
  updateAsoFlowCard,
  uploadAsoFlowDocument,
} from "./aso-flow";

type Data = Record<string, any>;
let db: Map<string, Data>, files: Map<string, Buffer>, queue: Promise<unknown>;
let afterQueryRead: ((path: string) => void) | undefined;
const user = {
  uid: "operator",
  email: "operator@example.test",
  role: "SUPER_ADMIN",
  tenantId: null,
  servedCompanies: [],
  permissions: [],
} as AuthContext;
const row: AsoFlowRow = {
  companyCnpj: "11.222.333/0001-81",
  employeeCpf: "529.982.247-25",
  employeeName: "Pessoa Teste",
  city: "Curitiba",
  state: "PR",
  unit: "Sede",
  examType: "periodico",
  cycle: "2026-10",
  sourceRow: 7,
};
const input = (rows = [row]) => ({ rows, sourceName: "campanha-sintetica.xlsx" });
const casePath = (id: string) => `clinic_portal_private/aso-flow/cases/${id}`;
function snap(path: string): any {
  return {
    id: path.split("/").at(-1),
    ref: ref(path),
    exists: db.has(path),
    data: () => (db.has(path) ? structuredClone(db.get(path)) : undefined),
  };
}
function ref(path: string): any {
  return {
    path,
    id: path.split("/").at(-1),
    collection: (name: string) => query(`${path}/${name}`),
    get: async () => snap(path),
  };
}
function query(
  path: string,
  filters: Array<[string, string, unknown]> = [],
  take = Infinity,
  cursor = ""
): any {
  return {
    path,
    _query: true,
    doc: (id: string) => ref(`${path}/${id}`),
    where: (field: string, op: string, val: unknown) =>
      query(path, [...filters, [field, op, val]], take, cursor),
    limit: (n: number) => query(path, filters, n, cursor),
    orderBy: () => query(path, filters, take, cursor),
    startAfter: (id: string) => query(path, filters, take, id),
    add: async (data: Data) => db.set(`${path}/audit-${db.size}`, structuredClone(data)),
    get: async () => {
      const docs = [...db.keys()]
        .filter(
          (key) =>
            key.startsWith(`${path}/`) &&
            key.split("/").length === path.split("/").length + 1 &&
            key.split("/").at(-1)! > cursor
        )
        .sort()
        .filter((key) =>
          filters.every(([field, op, val]) => {
            const fieldValue = db.get(key)![field];
            return op === "=="
              ? fieldValue === val
              : op === "in"
                ? (val as unknown[]).includes(fieldValue)
                : op === "array-contains"
                  ? fieldValue?.includes(val)
                  : op === "array-contains-any"
                    ? (val as unknown[]).some((v) => fieldValue?.includes(v))
                    : false;
          })
        )
        .slice(0, take)
        .map(snap);
      afterQueryRead?.(path);
      return { docs, size: docs.length };
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  db = new Map();
  files = new Map();
  queue = Promise.resolve();
  afterQueryRead = undefined;
  m.collection.mockImplementation(query);
  m.file.mockImplementation((path: string) => ({
    save: async (bytes: Buffer) => {
      if (files.has(path)) throw { code: 412 };
      files.set(path, Buffer.from(bytes));
    },
    download: async () => {
      if (!files.has(path)) throw Error("missing file");
      return [Buffer.from(files.get(path)!)];
    },
  }));
  m.transaction.mockImplementation((fn) => {
    const run = queue.then(async () => {
      let writing = false;
      const writes: Array<() => void> = [];
      const write = (path: string, data: Data) => {
        writing = true;
        writes.push(() => db.set(path, structuredClone(data)));
      };
      const result = await fn({
        get: async (target: any) => {
          if (writing) throw Error("Read after write");
          return target._query ? target.get() : snap(target.path);
        },
        create: (r: any, data: Data) => {
          if (db.has(r.path)) throw Error("Document already exists");
          write(r.path, data);
        },
        set: (r: any, data: Data) => write(r.path, data),
        update: (r: any, data: Data) => {
          if (!db.has(r.path)) throw Error("Missing document");
          write(r.path, { ...db.get(r.path), ...data });
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
  db.set("companies/ONE", {
    active: true,
    name: "Cliente Teste",
    cnpj: row.companyCnpj,
    contactEmail: "cliente@example.test",
    socCompanyId: "1234",
  });
  db.set("companies/ONE/employees/E1", {
    name: row.employeeName,
    cpf: row.employeeCpf,
    status: "active",
    companyId: "ONE",
    job_role: { title: "Assistente" },
    department: "Administrativo",
  });
  db.set("providers/CLINIC", {
    name: "Clínica Teste",
    active: true,
    type: "CLINIC",
    servedCompanies: ["ONE"],
    email: "clinica@example.test",
  });
  db.set("users/operator", { role: "SUPER_ADMIN", accessEnabled: true, servedCompanies: [] });
});
const create = async () => (await importAsoFlowRows(user, input())).cards[0];
const schedule = (card: AsoFlowCard) =>
  updateAsoFlowCard(user, {
    action: "schedule",
    id: card.id,
    version: card.version,
    clinicId: "CLINIC",
    date: "2026-10-20",
    time: "08:30",
    reference: "Confirmação da clínica no email synthetic-1",
  });
const pdf = (body = "synthetic") => Buffer.from(`%PDF-1.7\n${body}\n${" ".repeat(100)}%%EOF`);
const receive = (card: AsoFlowCard, bytes = pdf()) =>
  uploadAsoFlowDocument(
    user,
    {
      action: "receive_aso",
      id: card.id,
      version: card.version,
      identityConfirmed: true,
      examDate: "2026-10-20",
      source: "email",
      reference: "Mensagem synthetic-2",
    },
    bytes,
    "aso.pdf"
  );
const review = (card: AsoFlowCard) =>
  updateAsoFlowCard(user, {
    action: "review_aso",
    id: card.id,
    version: card.version,
    identityConfirmed: true,
    documentChecked: true,
  });
const nativeKit = (card: AsoFlowCard, order = "123456", bytes = pdf("native-kit")) =>
  uploadAsoFlowDocument(
    user,
    {
      action: "record_soc_kit",
      id: card.id,
      version: card.version,
      identityConfirmed: true,
      socOrder: order,
      socCompanyId: "1234",
      reference: "Pedido SOC nativo conferido no original",
    },
    bytes,
    "kit.pdf"
  );
describe("revogação durante operações da esteira", () => {
  it.each(["preview", "cards", "clinics"] as const)(
    "não libera %s de uma carteira revogada enquanto a consulta estava em andamento",
    async (operation) => {
      await create();
      if (operation === "cards") db.get("providers/CLINIC")!.servedCompanies = [];
      const trigger = {
        preview: "companies",
        cards: "clinic_portal_private/aso-flow/cases",
        clinics: "providers",
      }[operation];
      afterQueryRead = (path) => {
        if (path === trigger)
          Object.assign(db.get("users/operator")!, {
            role: "OPERATIONS",
            servedCompanies: ["OTHER"],
          });
      };
      const result =
        operation === "preview"
          ? previewAsoFlowImport(user, input())
          : operation === "cards"
            ? listAsoFlowCards(user)
            : listAsoFlowClinics(user);
      await expect(result).rejects.toMatchObject({ status: 403 });
    }
  );

  it.each([{ isDeleted: true }, { role: "OPERATIONS", servedCompanies: ["OTHER"] }])(
    "não importa com contexto antigo após mudança do perfil: %j",
    async (change) => {
      Object.assign(db.get("users/operator")!, change);
      const before = structuredClone(db);
      await expect(importAsoFlowRows(user, input())).rejects.toMatchObject({ status: 403 });
      expect(db).toEqual(before);
    }
  );

  it("não confirma revisão quando a permissão é revogada durante a leitura do original", async () => {
    const card = await receive(await create());
    const before = structuredClone(db.get(casePath(card.id)));
    const file = m.file.getMockImplementation()!;
    m.file.mockImplementation((path: string) => {
      const stored = file(path);
      return {
        ...stored,
        download: async () => {
          const result = await stored.download();
          db.get("users/operator")!.accessEnabled = false;
          return result;
        },
      };
    });
    await expect(review(card)).rejects.toMatchObject({ status: 403 });
    expect(db.get(casePath(card.id))).toEqual(before);
    expect([...db.keys()].some((path) => path.includes("/clientArchives/"))).toBe(false);
  });

  it("não vincula upload quando o operador é excluído durante a gravação privada", async () => {
    const card = await create();
    const before = structuredClone(db.get(casePath(card.id)));
    const file = m.file.getMockImplementation()!;
    m.file.mockImplementation((path: string) => {
      const stored = file(path);
      return {
        ...stored,
        save: async (bytes: Buffer) => {
          await stored.save(bytes);
          db.get("users/operator")!.isDeleted = true;
        },
      };
    });
    await expect(receive(card)).rejects.toMatchObject({ status: 403 });
    expect(db.get(casePath(card.id))).toEqual(before);
    expect(db.has(`${casePath(card.id)}/history/${card.version + 1}`)).toBe(false);
  });

  it.each([
    { accessEnabled: false },
    { isDeleted: true },
    { role: "OPERATIONS", servedCompanies: ["OTHER"] },
  ])("não libera o PDF se o acesso muda durante o download: %j", async (change) => {
    const card = await receive(await create());
    const file = m.file.getMockImplementation()!;
    m.file.mockImplementation((path: string) => {
      const stored = file(path);
      return {
        ...stored,
        download: async () => {
          const result = await stored.download();
          Object.assign(db.get("users/operator")!, change);
          return result;
        },
      };
    });
    await expect(readAsoFlowDocument(user, card.id, "aso")).rejects.toMatchObject({ status: 403 });
    expect([...db.keys()].some((path) => path.includes("/documentAccess/"))).toBe(false);
  });
});
describe("resolução e importação canônica", () => {
  it("aceita retorno de afastado e demissional de desligado sem alterar o cadastro", async () => {
    db.get("companies/ONE/employees/E1")!.status = "leave";
    const returning = (
      await importAsoFlowRows(user, input([{ ...row, examType: "retorno_trabalho" }]))
    ).cards[0];
    const scheduled = await schedule(returning);
    expect(scheduled.status).toBe("scheduled");
    const kit = await nativeKit(scheduled);
    const outboxId = "f".repeat(64);
    await reserveAsoFlowMail(user, {
      id: kit.id,
      version: kit.version,
      kind: "kit",
      recipient: "clinica@example.test",
      documentHash: kit.kit!.hash,
      outboxId,
      mailbox: "operacao@example.test",
      messageId: `<nai-aso-${outboxId}@example.test>`,
      startedAt: "2026-10-20T12:00:00Z",
    });
    expect(db.get("companies/ONE/employees/E1")!.status).toBe("leave");
    db.get("companies/ONE/employees/E1")!.status = "fired";
    expect((await previewAsoFlowImport(user, input())).blocked).toBe(1);
    expect(
      (await importAsoFlowRows(user, input([{ ...row, examType: "demissional" }]))).created
    ).toBe(1);
    expect(db.get("companies/ONE/employees/E1")!.status).toBe("fired");
  });
  it("preserva pendências por linha e resolve CNPJ/CPF formatados sem associar apenas por nome", async () => {
    const p = await previewAsoFlowImport(
      user,
      input([row, { ...row, employeeCpf: "", sourceRow: 8 }])
    );
    expect(p).toMatchObject({ ready: 1, blocked: 1 });
    expect(p.rows[0]).toMatchObject({ companyId: "ONE", employeeId: "E1", index: 7 });
    expect(p.rows[1].errors.join(" ")).toContain("CPF");
    expect([...db.keys()].filter((p) => p.startsWith("clinic_portal_private"))).toHaveLength(0);
  });
  it("bloqueia cadastro ambíguo, divergência de nome e empresa fora do escopo", async () => {
    expect(
      (await previewAsoFlowImport(user, input([{ ...row, employeeName: "Homônimo" }]))).blocked
    ).toBe(1);
    db.set("companies/ONE/employees/E2", structuredClone(db.get("companies/ONE/employees/E1"))!);
    expect((await previewAsoFlowImport(user, input())).blocked).toBe(1);
    db.delete("companies/ONE/employees/E2");
    const restricted = { ...user, role: "OPERATIONS" as const, servedCompanies: ["TWO"] };
    const p = await previewAsoFlowImport(restricted, input());
    expect(p.blocked).toBe(1);
    expect(p.rows[0].companyName).toBeUndefined();
  });
  it("não duplica reimportações, concorrência ou repetição na mesma planilha", async () => {
    const [a, b] = await Promise.all([
      importAsoFlowRows(user, input([row, row])),
      importAsoFlowRows(user, input()),
    ]);
    expect(a.created + b.created).toBe(1);
    expect(a.unchanged + b.unchanged).toBe(2);
    expect((await previewAsoFlowImport(user, input())).existing).toBe(1);
    const data = [...db.values()].find((d) => d.employeeIdentityHash);
    expect(data).toMatchObject({
      companyId: "ONE",
      employeeId: "E1",
      status: "pending",
      version: 1,
    });
    expect(data).not.toHaveProperty("employeeCpf");
  });
  it("revalida identidade na importação e não cria parte de um lote com pendência", async () => {
    await previewAsoFlowImport(user, input());
    db.get("companies/ONE/employees/E1")!.status = "inactive";
    await expect(importAsoFlowRows(user, input())).rejects.toMatchObject({ status: 409 });
    expect([...db.keys()].filter((p) => p.includes("/cases/"))).toHaveLength(0);
  });
  it.each(["cpf", "cnpj", "name"])(
    "bloqueia reimportação quando %s muda no mesmo ID cadastral, sem substituir o histórico",
    async (field) => {
      const original = await create();
      const corrected = { ...row };
      if (field === "cpf") {
        corrected.employeeCpf = "111.444.777-35";
        db.get("companies/ONE/employees/E1")!.cpf = corrected.employeeCpf;
      } else if (field === "cnpj") {
        corrected.companyCnpj = "04.252.011/0001-10";
        db.get("companies/ONE")!.cnpj = corrected.companyCnpj;
      } else {
        corrected.employeeName = "Outra Pessoa Teste";
        db.get("companies/ONE/employees/E1")!.name = corrected.employeeName;
      }
      const batch = input([corrected, { ...corrected, cycle: "2026-11" }]);
      const preview = await previewAsoFlowImport(user, batch);
      expect(preview).toMatchObject({ blocked: 1, existing: 0, ready: 1 });
      expect(preview.rows[0].errors.join(" ")).toContain("card existente");
      const before = structuredClone(db);
      await expect(importAsoFlowRows(user, batch)).rejects.toMatchObject({ status: 409 });
      expect(db).toEqual(before);
      expect(await getAsoFlowCard(user, original.id)).toEqual(original);
    }
  );
  it("não trata card sem fingerprint ou com vínculo divergente como duplicata válida", async () => {
    const card = await create();
    const stored = db.get(casePath(card.id))!;
    delete stored.employeeIdentityHash;
    expect((await previewAsoFlowImport(user, input())).blocked).toBe(1);
    stored.employeeIdentityHash = card.employeeIdentityHash;
    stored.employeeId = "OTHER";
    expect((await previewAsoFlowImport(user, input())).blocked).toBe(1);
    await expect(importAsoFlowRows(user, input())).rejects.toMatchObject({ status: 409 });
    expect(db.get(casePath(card.id))?.employeeId).toBe("OTHER");
  });
  it("recusa perfis de cliente/prestador e filtra cards/clínicas por carteira", async () => {
    const card = await create();
    await expect(
      getAsoFlowCard({ ...user, role: "CLIENT_ADMIN", tenantId: "ONE" }, card.id)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      getAsoFlowCard({ ...user, role: "SCOPED_PROVIDER" }, card.id)
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await listAsoFlowCards({ ...user, role: "OPERATIONS", servedCompanies: ["TWO"] })).cards
    ).toEqual([]);
  });
});
describe("ações com evidência e concorrência", () => {
  it("exige clínica vinculada e referência, e recusa segundo editor com versão antiga", async () => {
    const card = await create();
    db.get("providers/CLINIC")!.servedCompanies = ["OTHER"];
    await expect(schedule(card)).rejects.toMatchObject({ status: 400 });
    db.get("providers/CLINIC")!.servedCompanies = ["ONE"];
    expect((await schedule(card)).status).toBe("scheduled");
    await expect(schedule(card)).rejects.toMatchObject({ status: 409 });
  });
  it("recusa agendar periódico quando o vínculo muda para desligado após importar", async () => {
    const card = await create();
    db.get("companies/ONE/employees/E1")!.status = "fired";
    await expect(schedule(card)).rejects.toMatchObject({ status: 409 });
    expect((await getAsoFlowCard(user, card.id)).status).toBe("pending");
  });
  it("recusa avanço genérico e kit/entrega sem arquivo real", async () => {
    const card = await schedule(await create());
    await expect(
      updateAsoFlowCard(user, {
        action: "advance",
        id: card.id,
        version: card.version,
        status: "delivered",
      })
    ).rejects.toMatchObject({ status: 400 });
    await expect(review(card)).rejects.toMatchObject({ status: 409 });
    await expect(
      updateAsoFlowCard(user, {
        action: "record_kit_delivery",
        id: card.id,
        version: card.version,
        recipient: "clinica@example.test",
        reference: "enviado",
        sentAt: "2026-10-20T12:00:00Z",
        confirmed: true,
      })
    ).rejects.toMatchObject({ status: 409 });
  });
  it("vincula pedido nativo SOC uma só vez e não confunde anexar com enviar", async () => {
    const card = await nativeKit(await schedule(await create()));
    expect(card.status).toBe("scheduled");
    expect(card.kitDelivery).toBeUndefined();
    const other = (await importAsoFlowRows(user, input([{ ...row, cycle: "2026-09" }]))).cards[0];
    await expect(nativeKit(await schedule(other))).rejects.toMatchObject({ status: 409 });
    const sent = await updateAsoFlowCard(user, {
      action: "record_kit_delivery",
      id: card.id,
      version: card.version,
      recipient: "clinica@example.test",
      reference: "Mensagem externa synthetic-3",
      sentAt: "2026-10-20T12:00:00Z",
      confirmed: true,
    });
    expect(sent).toMatchObject({
      status: "kit_sent",
      kitDelivery: { method: "manual", hash: card.kit!.hash },
    });
    await expect(nativeKit(sent, "999")).rejects.toMatchObject({ status: 409 });
  });
  it("preserva a reserva histórica do pedido SOC substituído e impede reutilização em outro card", async () => {
    const original = await nativeKit(await schedule(await create()), "123456");
    const replaced = await nativeKit(original, "654321", pdf("replacement-kit"));
    const orders = [...db.entries()].filter(([path]) => path.includes("/socOrders/"));
    expect(orders).toHaveLength(2);
    expect(orders.map(([, record]) => record)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caseId: original.id,
          employeeId: original.employeeId,
          current: false,
          replacementSocOrder: "654321",
        }),
        expect.objectContaining({ caseId: original.id, current: true }),
      ])
    );
    const other = await schedule(
      (await importAsoFlowRows(user, input([{ ...row, cycle: "2026-09" }]))).cards[0]
    );
    await expect(nativeKit(other, "123456", pdf("other-kit"))).rejects.toMatchObject({
      status: 409,
    });
    expect((await getAsoFlowCard(user, other.id)).kit).toBeUndefined();
    expect((await getAsoFlowCard(user, original.id)).kit).toEqual(replaced.kit);
    expect(db.get(`${casePath(original.id)}/history/${original.version}`)?.kit).toEqual(
      original.kit
    );
  });
  it("recusa código SOC divergente e CPF alterado depois da importação", async () => {
    const card = await schedule(await create());
    db.get("companies/ONE")!.socCompanyId = "9999";
    await expect(nativeKit(card)).rejects.toMatchObject({ status: 400 });
    db.get("companies/ONE/employees/E1")!.cpf = "111.444.777-35";
    await expect(receive(card)).rejects.toMatchObject({ status: 409 });
  });
  it("arquiva em pasta privada do cliente após conferência e entrega apenas ao destinatário cadastrado", async () => {
    const received = await receive(await create());
    expect(received.status).toBe("received");
    expect(received.archive).toBeUndefined();
    const checked = await review(received);
    expect(checked.archive).toMatchObject({
      companyId: "ONE",
      employeeId: "E1",
      hash: checked.aso!.hash,
    });
    expect([...files.keys()][0]).toContain("aso-flow-private/v1/clientes/ONE/asos/E1/");
    expect((await readAsoFlowDocument(user, checked.id, "aso")).bytes).toEqual(pdf());
    const delivery = {
      action: "record_delivery",
      id: checked.id,
      version: checked.version,
      recipient: "outro@example.test",
      reference: "Comprovante synthetic-4",
      deliveredAt: "2026-10-20T12:00:00Z",
      confirmed: true,
    };
    await expect(updateAsoFlowCard(user, delivery)).rejects.toMatchObject({ status: 400 });
    const delivered = await updateAsoFlowCard(user, {
      ...delivery,
      recipient: "cliente@example.test",
    });
    expect(delivered).toMatchObject({
      status: "delivered",
      delivery: { hash: checked.aso!.hash, method: "manual" },
    });
    await expect(receive(delivered, pdf("replacement"))).rejects.toMatchObject({ status: 409 });
  });
  it("substituir PDF limpa conferência/arquivo atual e preserva a versão anterior no histórico", async () => {
    const checked = await review(await receive(await create()));
    const replacement = await receive(checked, pdf("new-original"));
    expect(replacement.status).toBe("received");
    expect(replacement.review).toBeUndefined();
    expect(replacement.archive).toBeUndefined();
    expect(db.get(`${casePath(checked.id)}/history/${checked.version}`)?.aso.hash).toBe(
      checked.aso!.hash
    );
    expect(replacement.aso!.hash).not.toBe(checked.aso!.hash);
    const archived = () => [...db.entries()].filter(([path]) => path.includes("/clientArchives/"));
    expect(archived().map(([, document]) => document)).toEqual([
      expect.objectContaining({
        hash: checked.aso!.hash,
        current: false,
        superseded: true,
        supersededByHash: replacement.aso!.hash,
      }),
    ]);
    const reviewedReplacement = await review(replacement);
    expect(archived().filter(([, document]) => document.current)).toHaveLength(1);
    expect(archived().find(([, document]) => document.current)?.[1]).toMatchObject({
      hash: reviewedReplacement.aso!.hash,
      current: true,
      superseded: false,
    });
  });
  it("permite reconferir o ASO para completar ou atualizar destinatário, sem perder o original", async () => {
    delete db.get("companies/ONE")!.contactEmail;
    const checked = await review(await receive(await create()));
    expect(checked.clientEmail).toBe("");
    db.get("companies/ONE")!.contactEmail = "novo@example.test";
    const refreshed = await review(checked);
    expect(refreshed).toMatchObject({
      status: "reviewed",
      clientEmail: "novo@example.test",
      version: checked.version + 1,
      aso: { hash: checked.aso!.hash },
      archive: { hash: checked.aso!.hash },
    });
    expect(db.get(`${casePath(checked.id)}/history/${checked.version}`)?.clientEmail).toBe("");
    const delivered = await updateAsoFlowCard(user, {
      action: "record_delivery",
      id: refreshed.id,
      version: refreshed.version,
      recipient: "novo@example.test",
      reference: "Comprovante do envio revisado",
      deliveredAt: "2026-10-20T12:00:00Z",
      confirmed: true,
    });
    await expect(review(delivered)).rejects.toMatchObject({ status: 409 });
  });
  it("repetir o mesmo PDF preserva a revisão e a versão, sem duplicar a pasta", async () => {
    const checked = await review(await receive(await create()));
    const before = structuredClone(db);
    const again = await receive(checked);
    expect(again).toEqual(checked);
    expect(db).toEqual(before);
  });
  it("recupera resposta perdida do upload com versão antiga sem desfazer revisão posterior", async () => {
    const original = await create();
    const checked = await review(await receive(original));
    const before = structuredClone(db);
    const again = await receive(original);
    expect(again).toEqual(checked);
    expect(db).toEqual(before);
    expect(files.size).toBe(1);
  });
  it("converge uploads simultâneos do mesmo PDF para uma única revisão", async () => {
    const original = await create();
    const [a, b] = await Promise.all([receive(original), receive(original)]);
    expect(a).toEqual(b);
    expect(a.version).toBe(original.version + 1);
    expect(
      [...db.keys()].filter((path) => path.startsWith(`${casePath(a.id)}/history/`))
    ).toHaveLength(2);
    expect(files.size).toBe(1);
  });
  it("retoma upload após falha de commit usando o mesmo objeto privado já armazenado", async () => {
    const original = await create();
    m.transaction.mockRejectedValueOnce(new Error("Falha transitória de gravação"));
    await expect(receive(original)).rejects.toThrow("Falha transitória");
    expect((await getAsoFlowCard(user, original.id)).aso).toBeUndefined();
    expect(files.size).toBe(1);
    const recovered = await receive(original);
    expect(recovered).toMatchObject({ status: "received", version: original.version + 1 });
    expect(files.size).toBe(1);
  });
  it("retry antigo não substitui PDF nem aceita data ou identidade divergentes", async () => {
    const original = await create();
    const received = await receive(original);
    await expect(receive(original, pdf("different-file"))).rejects.toMatchObject({ status: 409 });
    await expect(
      uploadAsoFlowDocument(
        user,
        {
          action: "receive_aso",
          id: original.id,
          version: original.version,
          identityConfirmed: true,
          examDate: "2026-10-19",
          source: "email",
          reference: "Mensagem synthetic-2",
        },
        pdf(),
        "aso.pdf"
      )
    ).rejects.toMatchObject({ status: 409 });
    await expect(receive({ ...received, version: received.version + 1 })).rejects.toMatchObject({
      status: 409,
    });
    db.get("companies/ONE/employees/E1")!.cpf = "111.444.777-35";
    await expect(receive(original)).rejects.toMatchObject({ status: 409 });
    expect((await getAsoFlowCard(user, original.id)).aso).toEqual(received.aso);
    expect(files.size).toBe(1);
  });
  it.each([
    { source: "upload", reference: "Mensagem synthetic-2" },
    { source: "email", reference: "Outra referência de recebimento" },
  ])("retry antigo não declara uma origem de recebimento diferente: %j", async (evidence) => {
    const original = await create();
    const received = await receive(original);
    const before = structuredClone(db);
    await expect(
      uploadAsoFlowDocument(
        user,
        {
          action: "receive_aso",
          id: original.id,
          version: original.version,
          identityConfirmed: true,
          examDate: "2026-10-20",
          ...evidence,
        },
        pdf(),
        "aso.pdf"
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(db).toEqual(before);
    expect((await getAsoFlowCard(user, original.id)).aso).toEqual(received.aso);
  });
  it("retry antigo de kit preserva dados SOC e continua bloqueado durante envio reservado", async () => {
    const original = await schedule(await create());
    const kit = await nativeKit(original);
    expect(await nativeKit(original)).toEqual(kit);
    await expect(nativeKit(original, "999999")).rejects.toMatchObject({ status: 409 });
    db.get(casePath(kit.id))!.mailLock = { outboxId: "a".repeat(64), kind: "kit" };
    await expect(nativeKit(original)).rejects.toMatchObject({ status: 409 });
    expect((await getAsoFlowCard(user, kit.id)).kit).toEqual(kit.kit);
  });
  it("reserva o envio com cadastro e permissão frescos, impedindo corrida com alteração do card", async () => {
    const card = await nativeKit(await schedule(await create()));
    const outboxId = "c".repeat(64);
    const reservation = {
      id: card.id,
      version: card.version,
      kind: "kit" as const,
      recipient: "clinica@example.test",
      documentHash: card.kit!.hash,
      outboxId,
      mailbox: "operacao@example.test",
      messageId: `<nai-aso-${outboxId}@example.test>`,
      startedAt: "2026-10-20T12:00:00Z",
    };
    db.get("users/operator")!.accessEnabled = false;
    await expect(reserveAsoFlowMail(user, reservation)).rejects.toMatchObject({ status: 403 });
    db.get("users/operator")!.accessEnabled = true;
    db.get("users/operator")!.isDeleted = true;
    await expect(reserveAsoFlowMail(user, reservation)).rejects.toMatchObject({ status: 403 });
    db.get("users/operator")!.isDeleted = false;
    db.get("providers/CLINIC")!.servedCompanies = ["OTHER"];
    await expect(reserveAsoFlowMail(user, reservation)).rejects.toMatchObject({ status: 400 });
    db.get("providers/CLINIC")!.servedCompanies = ["ONE"];
    db.get("companies/ONE/employees/E1")!.cpf = "11144477735";
    await expect(reserveAsoFlowMail(user, reservation)).rejects.toMatchObject({ status: 409 });
    db.get("companies/ONE/employees/E1")!.cpf = row.employeeCpf;
    await reserveAsoFlowMail(user, reservation);
    expect(db.get(casePath(card.id))?.mailLock).toMatchObject({
      outboxId,
      documentHash: card.kit!.hash,
    });
    expect(db.get(`clinic_portal_private/aso-flow/outbox/${outboxId}`)).toMatchObject({
      state: "sending",
      caseId: card.id,
    });
    await expect(schedule(card)).rejects.toMatchObject({ status: 409 });
    await expect(reserveAsoFlowMail(user, reservation)).rejects.toMatchObject({ status: 409 });
  });
  it("não reserva envio de card cancelado nem de kit já enviado externamente", async () => {
    const card = await nativeKit(await schedule(await create()));
    const outboxId = "d".repeat(64);
    const reservation = {
      id: card.id,
      version: card.version,
      kind: "kit" as const,
      recipient: "clinica@example.test",
      documentHash: card.kit!.hash,
      outboxId,
      mailbox: "operacao@example.test",
      messageId: `<nai-aso-${outboxId}@example.test>`,
      startedAt: "2026-10-20T12:00:00Z",
    };
    const sent = await updateAsoFlowCard(user, {
      action: "record_kit_delivery",
      id: card.id,
      version: card.version,
      recipient: "clinica@example.test",
      reference: "Comprovante externo",
      sentAt: "2026-10-20T12:00:00Z",
      confirmed: true,
    });
    await expect(
      reserveAsoFlowMail(user, { ...reservation, version: sent.version })
    ).rejects.toMatchObject({ status: 409 });
    const cancelled = await updateAsoFlowCard(user, {
      action: "cancel",
      id: card.id,
      version: sent.version,
      reason: "Pedido cancelado pelo cliente",
      outcome: "cancelled",
    });
    await expect(
      reserveAsoFlowMail(user, { ...reservation, version: cancelled.version })
    ).rejects.toMatchObject({ status: 409 });
    expect(db.has(`clinic_portal_private/aso-flow/outbox/${outboxId}`)).toBe(false);
  });
  it("recusa PDF adulterado antes da revisão/entrega e bloqueia mutação durante envio", async () => {
    const received = await receive(await create());
    files.set([...files.keys()][0], pdf("tampered"));
    await expect(review(received)).rejects.toMatchObject({ status: 409 });
    db.get(casePath(received.id))!.mailLock = { outboxId: "a".repeat(64), kind: "aso" };
    await expect(receive(received)).rejects.toMatchObject({ status: 409 });
    await expect(
      updateAsoFlowCard(user, {
        action: "cancel",
        id: received.id,
        version: received.version,
        reason: "Solicitação cancelada",
        outcome: "cancelled",
      })
    ).rejects.toMatchObject({ status: 409 });
  });
  it("comita envio confirmado e libera reserva atomicamente, sem aceitar comprovante de outro arquivo", async () => {
    const card = await review(await receive(await create())),
      outboxId = "a".repeat(64);
    db.get(casePath(card.id))!.mailLock = {
      outboxId,
      documentHash: card.aso!.hash,
      kind: "aso",
      recipient: "cliente@example.test",
      version: card.version,
      startedAt: "2026-10-20T12:00:00Z",
    };
    const outboxPath = `clinic_portal_private/aso-flow/outbox/${outboxId}`;
    db.set(outboxPath, { state: "sending" });
    const sent = {
      id: card.id,
      version: card.version,
      kind: "aso" as const,
      recipient: "cliente@example.test",
      providerMessageId: "message123",
      sentAt: "2026-10-20T12:01:00Z",
      documentHash: card.aso!.hash,
      outboxId,
    };
    await expect(
      recordAsoFlowSent(user, { ...sent, documentHash: "b".repeat(64) })
    ).rejects.toMatchObject({ status: 409 });
    db.get("users/operator")!.isDeleted = true;
    await expect(recordAsoFlowSent(user, sent)).rejects.toMatchObject({ status: 403 });
    expect(db.get(outboxPath)?.state).toBe("sending");
    expect(db.get(casePath(card.id))?.mailLock?.outboxId).toBe(outboxId);
    db.get("users/operator")!.isDeleted = false;
    const next = await recordAsoFlowSent(user, sent);
    expect(next.status).toBe("delivered");
    expect(next.mailLock).toBeUndefined();
    expect(db.get(outboxPath)).toMatchObject({
      state: "sent",
      providerMessageId: "message123",
      caseVersion: next.version,
    });
  });
});
