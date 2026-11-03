// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
import type { EsocialGrant } from "@/lib/esocial-messaging";
const state = vi.hoisted(() => ({
  docs: new Map<string, any>(),
  reads: [] as string[],
  writes: [] as { path: string; data: any }[],
  afterRead: undefined as ((path: string) => void) | undefined,
  failAuditWrites: false,
}));
vi.mock("@/lib/firebase-admin", () => {
  const snapshot = (path: string) => {
    const value = state.docs.has(path) ? structuredClone(state.docs.get(path)) : undefined;
    return {
      id: path.split("/").at(-1)!,
      exists: value !== undefined,
      data: () => value,
    };
  };
  function document(path: string): any {
    return {
      path,
      id: path.split("/").at(-1),
      collection: (name: string) => collection(`${path}/${name}`),
      get: async () => {
        state.reads.push(path);
        const value = snapshot(path);
        state.afterRead?.(path);
        return value;
      },
      set: async (data: any) => {
        if (state.failAuditWrites && path.includes("/audit/")) throw Error("Audit unavailable");
        state.writes.push({ path, data });
        state.docs.set(path, data);
      },
    };
  }
  function collection(path: string, filters: [string, unknown][] = [], limit = Infinity): any {
    return {
      path,
      doc: (id: string) => document(`${path}/${id}`),
      where: (field: string, _op: string, value: unknown) =>
        collection(path, [...filters, [field, value]], limit),
      select: () => collection(path, filters, limit),
      orderBy: () => collection(path, filters, limit),
      limit: (value: number) => collection(path, filters, value),
      get: async () => {
        state.reads.push(`${path}/*`);
        const docs = [...state.docs.keys()]
          .filter(
            (key) =>
              key.startsWith(`${path}/`) &&
              !key.slice(path.length + 1).includes("/") &&
              filters.every(([f, v]) => state.docs.get(key)?.[f] === v)
          )
          .slice(0, limit)
          .map(snapshot);
        state.afterRead?.(`${path}/*`);
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }
  return {
    adminDb: {
      collection: (path: string) => collection(path),
      getAll: async (...refs: any[]) => Promise.all(refs.filter((r) => r.path).map((r) => r.get())),
      runTransaction: async (run: (transaction: any) => Promise<any>) => {
        // Model optimistic read conflicts, rollback, atomic audit and Firestore's read-before-write rule.
        for (let attempt = 0; attempt < 5; attempt++) {
          const reads = new Map<string, string | undefined>();
          const writes: { path: string; data: any; create: boolean }[] = [];
          let writing = false;
          const write = (ref: any, data: any, create: boolean) => {
            writing = true;
            if (state.failAuditWrites && ref.path.includes("/audit/"))
              throw Error("Audit unavailable");
            writes.push({ path: ref.path, data: structuredClone(data), create });
          };
          const result = await run({
            get: async (ref: any) => {
              if (writing) throw Error("Read after write");
              reads.set(ref.path, JSON.stringify(state.docs.get(ref.path)));
              return ref.get();
            },
            set: (ref: any, data: any) => write(ref, data, false),
            create: (ref: any, data: any) => write(ref, data, true),
          });
          if ([...reads].some(([path, value]) => JSON.stringify(state.docs.get(path)) !== value))
            continue;
          if (writes.some((entry) => entry.create && state.docs.has(entry.path)))
            throw Error("Already exists");
          for (const { path, data } of writes) {
            state.docs.set(path, data);
            state.writes.push({ path, data });
          }
          return result;
        }
        throw Error("Transaction contention");
      },
    },
  };
});
import {
  esocialHash,
  esocialReader,
  getEsocialGrant,
  listEsocialCompanies,
  listEsocialEmployeeLinks,
  resolveEsocialIdentity,
  saveEsocialEmployeeLink,
  saveEsocialGrant,
  validateEsocialGrant,
} from "./records";
const operator: AuthContext = {
  uid: "operator-a",
  email: "operator@example.invalid",
  role: "OPERATIONS",
  tenantId: null,
  servedCompanies: ["company-a"],
  permissions: [],
};
const admin: AuthContext = { ...operator, role: "ADMIN" };
const privateRoot = "clinic_portal_private/esocial-messaging";
const linkPath = `${privateRoot}/links/${esocialHash("company-a:employee-a")}`;
const grantPath = `${privateRoot}/grants/company-a`;
const worker = { cpf: "12345678909", matricula: "REGISTERED-001" };
const employer = { type: "1" as const, number: "12345678" };
const inputLink = {
  companyId: "company-a",
  employeeId: "employee-a",
  matricula: "REGISTERED-001",
  reference: "Folha revisada pelo empregador",
  confirmed: true,
};
const inputGrant = {
  companyId: "company-a",
  granteeRegistration: "11.222.333/0001-81",
  profiles: ["sst"],
  validFrom: "2026-01-01",
  validUntil: "2026-12-31",
  reference: "Procuração conferida",
  active: true,
  confirmed: true,
};
function grant(patch: Partial<EsocialGrant> = {}): EsocialGrant {
  return {
    companyId: "company-a",
    granteeRegistration: "11222333000181",
    profiles: ["sst"],
    validFrom: "2026-01-01",
    validUntil: "2026-12-31",
    reference: "Procuração sintética conferida",
    active: true,
    confirmedAt: "2026-10-20T12:00:00Z",
    confirmedBy: "admin-a",
    verification: "operator_confirmed",
    ...patch,
  };
}
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  state.docs.clear();
  state.reads.length = 0;
  state.writes.length = 0;
  state.afterRead = undefined;
  state.failAuditWrites = false;
  state.docs.set("users/operator-a", {
    role: "OPERATIONS",
    accessEnabled: true,
    servedCompanies: ["company-a"],
    email: operator.email,
  });
  state.docs.set("companies/company-a", {
    name: "Cliente A sintético",
    cnpj: "12.345.678/0001-95",
    active: true,
  });
  state.docs.set("companies/company-b", {
    name: "Cliente B sintético",
    cnpj: "11.222.333/0001-81",
    active: true,
  });
  state.docs.set("companies/company-a/employees/employee-a", {
    name: "Trabalhador sintético",
    companyId: "company-a",
    cpf: "123.456.789-09",
    status: "active",
  });
  state.docs.set("companies/company-b/employees/employee-b", {
    name: "Trabalhador sintético B",
    companyId: "company-b",
    cpf: "123.456.789-09",
  });
  state.docs.set(linkPath, {
    companyId: "company-a",
    employeeId: "employee-a",
    cpf: worker.cpf,
    matricula: worker.matricula,
    reference: "Folha revisada",
    confirmedAt: "2026-10-20T12:00:00Z",
    confirmedBy: "operator-a",
  });
  state.docs.set(grantPath, grant());
});

describe("carteira, cadastro atual e confirmação do vínculo", () => {
  it("lista somente os clientes da carteira e seus vínculos autorizados", async () => {
    expect((await listEsocialCompanies(operator)).map((c) => c.id)).toEqual(["company-a"]);
    expect(await listEsocialEmployeeLinks(operator, "company-a")).toHaveLength(1);
    await expect(listEsocialEmployeeLinks(operator, "company-b")).rejects.toMatchObject({
      status: 403,
    });
    expect(state.reads).not.toContain("companies/company-b/employees/*");
  });
  it("administrador interno lista carteira, tenant externo não acessa mensageria", async () => {
    state.docs.set("users/operator-a", { ...state.docs.get("users/operator-a"), role: "ADMIN" });
    expect(await listEsocialCompanies(admin)).toHaveLength(2);
    await expect(listEsocialCompanies({ ...admin, tenantId: "company-a" })).rejects.toMatchObject({
      status: 403,
    });
  });
  it.each(["companies", "links", "grant"] as const)(
    "recusa retorno se a carteira é revogada durante a leitura de %s",
    async (resource) => {
      state.afterRead = (path) => {
        if (!path.startsWith("users/"))
          state.docs.set("users/operator-a", {
            role: "OPERATIONS",
            accessEnabled: true,
            servedCompanies: ["company-b"],
          });
      };
      const response =
        resource === "companies"
          ? listEsocialCompanies(operator)
          : resource === "links"
            ? listEsocialEmployeeLinks(operator, "company-a")
            : getEsocialGrant(operator, "company-a");
      await expect(response).rejects.toMatchObject({ status: 403 });
      expect(state.writes).toHaveLength(0);
    }
  );
  it("salva CPF do cadastro e a matrícula confirmada, com evidência e auditoria", async () => {
    const saved = await saveEsocialEmployeeLink(operator, inputLink);
    expect(saved).toMatchObject({
      companyId: "company-a",
      employeeId: "employee-a",
      cpf: "12345678909",
      matricula: "REGISTERED-001",
      confirmedBy: "operator-a",
    });
    expect(
      state.writes.some(
        (w) =>
          w.path.startsWith(`${privateRoot}/audit/`) &&
          w.data.action === "employment_link_confirmed"
      )
    ).toBe(true);
    await expect(
      saveEsocialEmployeeLink(operator, { ...inputLink, cpf: "52998224725" })
    ).rejects.toMatchObject({ status: 400 });
  });
  it.each([
    { accessEnabled: false, role: "OPERATIONS", servedCompanies: ["company-a"] },
    { accessEnabled: true, isDeleted: true, role: "ADMIN", servedCompanies: ["company-a"] },
    { accessEnabled: true, role: "OPERATIONS", servedCompanies: [] },
    { accessEnabled: true, role: "ADMIN", tenantId: "company-a" },
    { accessEnabled: true, role: "GUEST", servedCompanies: ["company-a"] },
  ])("releitura de perfil impede que claims antigos confirmem vínculos %#", async (profile) => {
    state.docs.set("users/operator-a", profile);
    await expect(saveEsocialEmployeeLink(admin, inputLink)).rejects.toMatchObject({ status: 403 });
    expect(state.writes).toHaveLength(0);
  });
  it("recusa cliente inativo, CPF inválido, dupla matrícula/categoria e ausência de confirmação", async () => {
    await expect(
      saveEsocialEmployeeLink(operator, { ...inputLink, category: 701 })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      saveEsocialEmployeeLink(operator, { ...inputLink, confirmed: false })
    ).rejects.toMatchObject({ status: 400 });
    state.docs.get("companies/company-a/employees/employee-a").cpf = "12345678900";
    await expect(saveEsocialEmployeeLink(operator, inputLink)).rejects.toMatchObject({
      status: 400,
    });
    state.docs.get("companies/company-a").active = false;
    await expect(saveEsocialEmployeeLink(operator, inputLink)).rejects.toMatchObject({
      status: 400,
    });
    expect(state.writes).toHaveLength(0);
  });
  it("não confirma vínculo quando o acesso é revogado depois da leitura inicial do cadastro", async () => {
    const previous = structuredClone(state.docs.get(linkPath));
    state.afterRead = (path) => {
      if (path !== "companies/company-a/employees/employee-a") return;
      state.afterRead = undefined;
      state.docs.get("users/operator-a").accessEnabled = false;
    };
    await expect(saveEsocialEmployeeLink(operator, inputLink)).rejects.toMatchObject({
      status: 403,
    });
    expect(state.docs.get(linkPath)).toEqual(previous);
    expect(state.writes).toHaveLength(0);
  });
  it("não reaproveita a confirmação se o CPF muda durante a operação", async () => {
    const previous = structuredClone(state.docs.get(linkPath));
    state.afterRead = (path) => {
      if (path !== "companies/company-a/employees/employee-a") return;
      state.afterRead = undefined;
      state.docs.get(path).cpf = "529.982.247-25";
    };
    await expect(saveEsocialEmployeeLink(operator, inputLink)).rejects.toMatchObject({
      status: 409,
    });
    expect(state.docs.get(linkPath)).toEqual(previous);
    expect(state.writes).toHaveLength(0);
  });
  it("revalida autorização quando o Firestore repete uma transação que perdeu a corrida", async () => {
    let profileReads = 0;
    state.afterRead = (path) => {
      if (path !== "users/operator-a" || ++profileReads !== 2) return;
      state.afterRead = undefined;
      state.docs.get(path).servedCompanies = [];
    };
    await expect(saveEsocialEmployeeLink(operator, inputLink)).rejects.toMatchObject({
      status: 403,
    });
    expect(state.writes).toHaveLength(0);
  });
  it("falha na auditoria não aplica a alteração da matrícula", async () => {
    const previous = structuredClone(state.docs.get(linkPath));
    state.failAuditWrites = true;
    await expect(
      saveEsocialEmployeeLink(operator, { ...inputLink, matricula: "CHANGED-002" })
    ).rejects.toThrow("Audit unavailable");
    expect(state.docs.get(linkPath)).toEqual(previous);
    expect(state.writes).toHaveLength(0);
  });
});

describe("resolução exata empregador/CPF/matrícula antes da assinatura", () => {
  it("correlaciona CPF com máscara sem fuzzy nem pesquisar fora do cliente", async () => {
    const value = await resolveEsocialIdentity(esocialReader, "company-a", employer, worker);
    expect(value).toMatchObject({
      companyId: "company-a",
      employeeId: "employee-a",
      employeeName: "Trabalhador sintético",
    });
    expect(state.reads.every((p) => !p.startsWith("companies/company-b"))).toBe(true);
    expect(value.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
  it("aceita alfa validado e base correspondente, mas respeita S-1000 explicitamente cadastrado", async () => {
    state.docs.get("companies/company-a").cnpj = "12.ABC.345/01DE-35";
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", { type: "1", number: "12ABC345" }, worker)
    ).resolves.toHaveProperty("employeeId", "employee-a");
    state.docs.get("companies/company-a").esocialRegistration = "12ABC345";
    await expect(
      resolveEsocialIdentity(
        esocialReader,
        "company-a",
        { type: "1", number: "12ABC34501DE35" },
        worker
      )
    ).rejects.toThrow("S-1000");
  });
  it.each([
    (c: any) => {
      c.cnpj = "12.345.678/0001-90";
    },
    (c: any) => {
      c.cnpj = "12345678";
    },
    (c: any) => {
      c.cnpj = "11.222.333/0001-81";
    },
    (c: any) => {
      c.active = false;
    },
    (c: any) => {
      c.isDeleted = true;
    },
  ])("recusa cadastro incompleto, alterado ou desativado %#", async (mutate) => {
    mutate(state.docs.get("companies/company-a"));
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", employer, worker)
    ).rejects.toMatchObject({ status: 400 });
  });
  it("recusa tpInsc incompatível, vínculo de outro cliente e CPF alterado", async () => {
    await expect(
      resolveEsocialIdentity(
        esocialReader,
        "company-a",
        { type: "2", number: "12345678909" },
        worker
      )
    ).rejects.toMatchObject({ status: 400 });
    state.docs.get("companies/company-a/employees/employee-a").companyId = "company-b";
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", employer, worker, "employee-a")
    ).rejects.toMatchObject({ status: 400 });
    state.docs.get("companies/company-a/employees/employee-a").companyId = "company-a";
    state.docs.get("companies/company-a/employees/employee-a").cpf = "52998224725";
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", employer, worker, "employee-a")
    ).rejects.toMatchObject({ status: 400 });
  });
  it("CPF ambíguo exige correção do cadastro quando não foi selecionado vínculo explícito", async () => {
    state.docs.set("companies/company-a/employees/duplicate", {
      cpf: "12345678909",
      name: "Duplicado",
    });
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", employer, worker)
    ).rejects.toThrow("único");
  });
  it("não declara CPF único quando registros excluídos ocultam outro colaborador além do limite", async () => {
    for (let index = 0; index < 3; index++)
      state.docs.set(`companies/company-a/employees/deleted-${index}`, {
        cpf: "12345678909",
        isDeleted: true,
      });
    state.docs.set("companies/company-a/employees/hidden-duplicate", {
      cpf: "12345678909",
      name: "Outro colaborador ativo",
    });
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", employer, worker)
    ).rejects.toThrow("único");
  });
  it.each([
    (link: any) => {
      link.companyId = "company-b";
    },
    (link: any) => {
      link.employeeId = "employee-b";
    },
    (link: any) => {
      link.matricula = "OTHER-001";
    },
    (link: any) => {
      link.cpf = "52998224725";
    },
    (link: any) => {
      delete link.confirmedBy;
    },
    (link: any) => {
      delete link.reference;
    },
    (link: any) => {
      link.category = 701;
    },
  ])("recusa link cuja identidade/evidência mudou %#", async (mutate) => {
    mutate(state.docs.get(linkPath));
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", employer, worker, "employee-a")
    ).rejects.toThrow("cadastro eSocial confirmado");
  });
  it("não transforma nome, ID do NAI ou categoria inventada em matrícula", async () => {
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", employer, { cpf: worker.cpf })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", employer, {
        cpf: worker.cpf,
        category: 999,
      })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      resolveEsocialIdentity(esocialReader, "company-a", employer, {
        cpf: worker.cpf,
        matricula: "employee-a",
      })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("procuração confirmada: cliente, titular, vigência e perfil do evento", () => {
  it("Grupo SST cobre S2230; toxicológico e sua exclusão exigem perfil próprio", () => {
    expect(() =>
      validateEsocialGrant(grant(), "11222333000181", "S2230", undefined, "company-a")
    ).not.toThrow();
    expect(() => validateEsocialGrant(grant(), "11222333000181", "S2221")).toThrow();
    expect(() => validateEsocialGrant(grant(), "11222333000181", "S3000", "S2221")).toThrow();
    expect(() =>
      validateEsocialGrant(
        grant({ profiles: ["toxicology"] }),
        "11222333000181",
        "S3000",
        "S2221",
        "company-a"
      )
    ).not.toThrow();
    expect(() => validateEsocialGrant(grant(), "11222333000181", "S3000")).toThrow();
  });
  it.each([
    { active: false },
    { companyId: "company-b" },
    { granteeRegistration: "12345678000195" },
    { validFrom: "2026-11-02" },
    { validUntil: "2026-10-31" },
    { validUntil: "invalid" },
    { profiles: [] },
    { confirmedBy: "" },
    { reference: "" },
    { verification: undefined },
  ])("impede uso de procuração incompatível ou não confirmada %#", (patch) => {
    expect(() =>
      validateEsocialGrant(
        grant(patch as Partial<EsocialGrant>),
        "11222333000181",
        "S2220",
        undefined,
        "company-a"
      )
    ).toThrow();
  });
  it("é administrador ATUAL quem confirma procuração e fica explícito que não houve consulta RFB", async () => {
    const input = {
      companyId: "company-a",
      granteeRegistration: "11.222.333/0001-81",
      profiles: ["sst"],
      validFrom: "2026-01-01",
      validUntil: "2026-12-31",
      reference: "Procuração conferida",
      active: true,
      confirmed: true,
    };
    await expect(saveEsocialGrant(admin, input)).rejects.toMatchObject({ status: 403 });
    state.docs.get("users/operator-a").role = "ADMIN";
    const saved = await saveEsocialGrant(admin, input);
    expect(saved).toMatchObject({
      companyId: "company-a",
      granteeRegistration: "11222333000181",
      verification: "operator_confirmed",
      confirmedBy: "operator-a",
    });
    expect(saved).not.toHaveProperty("rfbVerified");
  });
  it("não expõe concessão de outro cliente nem aceita CPF/CNPJ outorgado de formato/DV inválido", async () => {
    await expect(getEsocialGrant(operator, "company-b")).rejects.toMatchObject({ status: 403 });
    state.docs.get(grantPath).companyId = "company-b";
    await expect(getEsocialGrant(operator, "company-a")).rejects.toMatchObject({ status: 400 });
    state.docs.get("users/operator-a").role = "ADMIN";
    for (const registration of ["12345678", "12345678000190", "12345678900"])
      await expect(
        saveEsocialGrant(admin, {
          companyId: "company-a",
          granteeRegistration: registration,
          profiles: ["sst"],
          validFrom: "2026-01-01",
          validUntil: "2026-12-31",
          reference: "Procuração conferida",
          active: true,
          confirmed: true,
        })
      ).rejects.toMatchObject({ status: 400 });
  });
  it("não confirma procuração após perda concorrente do papel de administrador", async () => {
    const previous = structuredClone(state.docs.get(grantPath));
    state.docs.get("users/operator-a").role = "ADMIN";
    state.afterRead = (path) => {
      if (path !== "companies/company-a") return;
      state.afterRead = undefined;
      state.docs.get("users/operator-a").role = "OPERATIONS";
    };
    await expect(saveEsocialGrant(admin, inputGrant)).rejects.toMatchObject({ status: 403 });
    expect(state.docs.get(grantPath)).toEqual(previous);
    expect(state.writes).toHaveLength(0);
  });
  it.each([saveEsocialEmployeeLink, saveEsocialGrant])(
    "não vincula uma confirmação a outro empregador após mudança concorrente do CNPJ %#",
    async (save) => {
      state.docs.get("users/operator-a").role = "ADMIN";
      state.afterRead = (path) => {
        if (path !== "companies/company-a") return;
        state.afterRead = undefined;
        state.docs.get(path).cnpj = "11.222.333/0001-81";
      };
      await expect(
        save(admin, save === saveEsocialGrant ? inputGrant : inputLink)
      ).rejects.toMatchObject({ status: 409 });
      expect(state.writes).toHaveLength(0);
    }
  );
  it("falha na auditoria preserva a procuração anterior", async () => {
    const previous = structuredClone(state.docs.get(grantPath));
    state.docs.get("users/operator-a").role = "ADMIN";
    state.failAuditWrites = true;
    await expect(saveEsocialGrant(admin, { ...inputGrant, active: false })).rejects.toThrow(
      "Audit unavailable"
    );
    expect(state.docs.get(grantPath)).toEqual(previous);
    expect(state.writes).toHaveLength(0);
  });
});
