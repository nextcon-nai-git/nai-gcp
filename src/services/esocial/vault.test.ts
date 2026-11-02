// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
import {
  makeSyntheticA1,
  SYNTHETIC_CNPJ,
  SYNTHETIC_CPF,
  SYNTHETIC_PASSWORD,
} from "./certificate.test-fixtures";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  transaction: vi.fn(),
  permissions: vi.fn(),
  addVersion: vi.fn(),
  access: vi.fn(),
  auth: vi.fn(),
  secretmanager: vi.fn(),
  send: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: mocks.collection, runTransaction: mocks.transaction },
}));
vi.mock("googleapis/build/src/apis/secretmanager", () => ({
  auth: {
    GoogleAuth: class {
      constructor(options: unknown) {
        mocks.auth(options);
      }
    },
  },
  secretmanager: (...args: unknown[]) => {
    mocks.secretmanager(...args);
    return {
      projects: {
        secrets: {
          testIamPermissions: mocks.permissions,
          addVersion: mocks.addVersion,
          versions: { access: mocks.access },
        },
      },
    };
  },
}));
vi.mock("./transport", () => ({ sendEsocialBatch: mocks.send, queryEsocialBatch: mocks.query }));

import {
  canManageEsocialConnection,
  currentEsocialUser,
  esocialDocumentId,
  requireEsocialMessagingAccess,
} from "./access";
import {
  esocialCertificateStatus,
  esocialVaultReady,
  loadEsocialCertificate,
  retireEsocialCertificate,
  uploadEsocialCertificate,
} from "./vault";

type Data = Record<string, unknown>;
const root = "clinic_portal_private/esocial-messaging";
const secret = "projects/synthetic-project/secrets/nai-esocial-a1-test";
const admin: AuthContext = {
  uid: "synthetic-admin",
  email: "operator@example.test",
  role: "ADMIN",
  tenantId: null,
  servedCompanies: [],
  permissions: [],
};
let db: Map<string, Data>;
let secrets: Map<string, string>;
let writes: { path: string; value: Data }[];

function snapshot(path: string) {
  return { exists: db.has(path), data: () => structuredClone(db.get(path)) };
}
function write(path: string, value: Data, merge = false) {
  const data = merge ? { ...db.get(path), ...value } : value;
  db.set(path, structuredClone(data));
  writes.push({ path, value: structuredClone(value) });
}
function reference(path: string) {
  return {
    path,
    collection: (name: string) => collection(`${path}/${name}`),
    get: async () => snapshot(path),
    update: async (value: Data) => write(path, value, true),
  };
}
function collection(path: string) {
  return { doc: (id: string) => reference(`${path}/${id}`) };
}
function certificateRecords() {
  return [...db.entries()]
    .filter(([path]) => path.startsWith(`${root}/certificates/`))
    .map(([, value]) => value);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ESOCIAL_A1_SECRET_NAME", secret);
  db = new Map([
    [`users/${admin.uid}`, { role: "ADMIN", accessEnabled: true, email: admin.email }],
  ]);
  secrets = new Map();
  writes = [];
  mocks.collection.mockImplementation(collection);
  mocks.transaction.mockImplementation(async (run: (transaction: unknown) => Promise<unknown>) => {
    const pending: (() => void)[] = [];
    const result = await run({
      get: async (ref: { path: string }) => {
        if (pending.length) throw new Error("Transaction read after write");
        return snapshot(ref.path);
      },
      create: (ref: { path: string }, value: Data) =>
        pending.push(() => {
          if (db.has(ref.path)) throw new Error("Document already exists");
          write(ref.path, value);
        }),
      set: (ref: { path: string }, value: Data) => pending.push(() => write(ref.path, value)),
      update: (ref: { path: string }, value: Data) =>
        pending.push(() => write(ref.path, value, true)),
    });
    pending.forEach((apply) => apply());
    return result;
  });
  mocks.permissions.mockResolvedValue({
    data: { permissions: ["secretmanager.versions.add", "secretmanager.versions.access"] },
  });
  mocks.addVersion.mockImplementation(
    async (args: { parent: string; requestBody: { payload: { data: string } } }) => {
      const name = `${args.parent}/versions/${secrets.size + 1}`;
      secrets.set(name, args.requestBody.payload.data);
      return { data: { name } };
    }
  );
  mocks.access.mockImplementation(async (args: { name: string }) => {
    if (!secrets.has(args.name)) throw new Error("synthetic access denied");
    return { data: { payload: { data: secrets.get(args.name) } } };
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("A1 vault custody — mocked Secret Manager, no real credentials or transmissions", () => {
  it("stores only a pinned secret reference and public metadata in private Firestore", async () => {
    const certificate = makeSyntheticA1();
    const status = await uploadEsocialCertificate(
      admin,
      certificate.pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CNPJ
    );
    expect(status).toMatchObject({
      configured: true,
      vaultConfigured: true,
      localValid: true,
      registration: SYNTHETIC_CNPJ,
      verifiedInRestricted: false,
    });
    const record = certificateRecords()[0];
    expect(record.secretVersion).toBe(`${secret}/versions/1`);
    expect(writes.every((item) => item.path.startsWith(root + "/"))).toBe(true);
    const storedFirestore = JSON.stringify(writes);
    expect(storedFirestore).not.toContain(SYNTHETIC_PASSWORD);
    expect(storedFirestore).not.toContain(certificate.pfx.toString("base64"));
    expect(storedFirestore).not.toContain("PRIVATE KEY");
    expect(storedFirestore).toContain("certificate_uploaded");
    const storedSecret = JSON.parse(
      Buffer.from(secrets.get(`${secret}/versions/1`)!, "base64").toString()
    );
    expect(storedSecret).toEqual({
      format: 1,
      pfx: certificate.pfx.toString("base64"),
      password: SYNTHETIC_PASSWORD,
    });
    expect(mocks.addVersion.mock.calls[0][1]).toMatchObject({ retry: false, timeout: 15000 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("reopens only the pinned version and rechecks fingerprint and holder", async () => {
    const status = await uploadEsocialCertificate(
      admin,
      makeSyntheticA1().pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CNPJ
    );
    const result = await loadEsocialCertificate(status.id);
    expect(result.material.metadata.holder.number).toBe(SYNTHETIC_CNPJ);
    expect(mocks.access).toHaveBeenCalledWith(
      { name: `${secret}/versions/1` },
      { timeout: 15000, retry: false }
    );
    const path = `${root}/certificates/${status.id}`;
    db.set(path, { ...db.get(path), fingerprint: "tampered" });
    await expect(loadEsocialCertificate(status.id)).rejects.toThrow(
      "Não foi possível abrir um A1 válido"
    );
  });
  it("normalizes the API's canonical project number and loads only the configured parent", async () => {
    mocks.addVersion.mockImplementationOnce(
      async (args: { parent: string; requestBody: { payload: { data: string } } }) => {
        secrets.set(`${args.parent}/versions/7`, args.requestBody.payload.data);
        return {
          data: { name: "projects/123456789012/secrets/nai-esocial-a1-test/versions/7" },
        };
      }
    );
    const status = await uploadEsocialCertificate(
      admin,
      makeSyntheticA1().pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CNPJ
    );
    expect(mocks.addVersion.mock.calls[0][0].parent).toBe(secret);
    expect(certificateRecords()[0].secretVersion).toBe(`${secret}/versions/7`);
    expect((await loadEsocialCertificate(status.id)).material.metadata.fingerprint256).toBe(
      status.fingerprint
    );
    expect(mocks.access).toHaveBeenCalledWith(
      { name: `${secret}/versions/7` },
      { timeout: 15000, retry: false }
    );

    // Same holder and a valid synthetic A1, but a different certificate fingerprint.
    secrets.set(
      `${secret}/versions/7`,
      Buffer.from(
        JSON.stringify({
          format: 1,
          pfx: makeSyntheticA1({ policy: "2.16.76.1.2.1.998" }).pfx.toString("base64"),
          password: SYNTHETIC_PASSWORD,
        })
      ).toString("base64")
    );
    await expect(loadEsocialCertificate(status.id)).rejects.toThrow(
      "Não foi possível abrir um A1 válido"
    );
    expect(mocks.access.mock.calls.every(([args]) => args.name === `${secret}/versions/7`)).toBe(
      true
    );
  });
  it("preserves an explicitly configured project number", async () => {
    const numberedSecret = "projects/123456789012/secrets/nai-esocial-a1-test";
    vi.stubEnv("ESOCIAL_A1_SECRET_NAME", numberedSecret);
    const status = await uploadEsocialCertificate(
      admin,
      makeSyntheticA1().pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CNPJ
    );
    expect(certificateRecords()[0].secretVersion).toBe(`${numberedSecret}/versions/1`);
    await loadEsocialCertificate(status.id);
    expect(mocks.access).toHaveBeenCalledWith(
      { name: `${numberedSecret}/versions/1` },
      { timeout: 15000, retry: false }
    );
  });
  it("rejects a different project number when the configured parent is already numeric", async () => {
    vi.stubEnv("ESOCIAL_A1_SECRET_NAME", "projects/123456789012/secrets/nai-esocial-a1-test");
    mocks.addVersion.mockResolvedValueOnce({
      data: { name: "projects/999999999999/secrets/nai-esocial-a1-test/versions/1" },
    });
    await expect(
      uploadEsocialCertificate(admin, makeSyntheticA1().pfx, SYNTHETIC_PASSWORD, SYNTHETIC_CNPJ)
    ).rejects.toThrow("cofre não confirmou");
    expect(writes).toHaveLength(0);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("does not upload files beyond the limit, wrong passwords or an unconfirmed holder", async () => {
    await expect(
      uploadEsocialCertificate(admin, Buffer.alloc(40 * 1024 + 1), "", SYNTHETIC_CNPJ)
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      uploadEsocialCertificate(admin, makeSyntheticA1().pfx, "wrong-password", SYNTHETIC_CNPJ)
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      uploadEsocialCertificate(admin, makeSyntheticA1().pfx, SYNTHETIC_PASSWORD, "12345678000195")
    ).rejects.toThrow("titular");
    expect(mocks.addVersion).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it("requires both version creation/access IAM permissions and a constrained secret name", async () => {
    mocks.permissions.mockResolvedValue({ data: { permissions: ["secretmanager.versions.add"] } });
    expect(await esocialVaultReady()).toBe(false);
    await expect(
      uploadEsocialCertificate(admin, makeSyntheticA1().pfx, SYNTHETIC_PASSWORD, SYNTHETIC_CNPJ)
    ).rejects.toMatchObject({ status: 503 });
    expect(mocks.addVersion).not.toHaveBeenCalled();
    vi.stubEnv("ESOCIAL_A1_SECRET_NAME", "projects/synthetic-project/secrets/unrelated-secret");
    mocks.permissions.mockClear();
    expect(await esocialVaultReady()).toBe(false);
    expect(mocks.permissions).not.toHaveBeenCalled();
  });
  it("does not activate an unconfirmed Secret Manager write or an unpinned version", async () => {
    mocks.addVersion.mockRejectedValueOnce(new Error("private provider diagnostic"));
    await expect(
      uploadEsocialCertificate(admin, makeSyntheticA1().pfx, SYNTHETIC_PASSWORD, SYNTHETIC_CNPJ)
    ).rejects.toThrow("cofre não confirmou");
    expect(writes).toHaveLength(0);
    mocks.addVersion.mockResolvedValueOnce({ data: { name: `${secret}/versions/latest` } });
    await expect(
      uploadEsocialCertificate(admin, makeSyntheticA1().pfx, SYNTHETIC_PASSWORD, SYNTHETIC_CNPJ)
    ).rejects.toThrow("cofre não confirmou");
    expect(writes).toHaveLength(0);
  });
  it.each([
    ["different secret", "projects/123456789012/secrets/nai-esocial-a1-other/versions/1"],
    ["different textual project", "projects/other-project/secrets/nai-esocial-a1-test/versions/1"],
    ["zero version", `${secret}/versions/0`],
    ["noncanonical version", `${secret}/versions/01`],
  ])("rejects an addVersion confirmation for %s", async (_case, returnedName) => {
    mocks.addVersion.mockResolvedValueOnce({ data: { name: returnedName } });
    await expect(
      uploadEsocialCertificate(admin, makeSyntheticA1().pfx, SYNTHETIC_PASSWORD, SYNTHETIC_CNPJ)
    ).rejects.toThrow("cofre não confirmou");
    expect(writes).toHaveLength(0);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("rotates atomically, retains old references for receipt queries, and never auto-transmits", async () => {
    const first = await uploadEsocialCertificate(
      admin,
      makeSyntheticA1().pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CNPJ
    );
    const second = await uploadEsocialCertificate(
      admin,
      makeSyntheticA1({ cpf: true }).pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CPF
    );
    expect(second.id).not.toBe(first.id);
    expect(db.get(`${root}/settings/certificate`)?.activeId).toBe(second.id);
    expect(db.get(`${root}/certificates/${first.id}`)?.active).toBe(false);
    await expect(loadEsocialCertificate(first.id)).rejects.toThrow("indisponível");
    expect((await loadEsocialCertificate(first.id, true)).id).toBe(first.id);
    expect((await loadEsocialCertificate()).id).toBe(second.id);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("retires the active certificate with audit and blocks further signing loads", async () => {
    const status = await uploadEsocialCertificate(
      admin,
      makeSyntheticA1().pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CNPJ
    );
    expect(await retireEsocialCertificate(admin)).toMatchObject({
      configured: false,
      localValid: false,
    });
    expect(db.get(`${root}/settings/certificate`)?.activeId).toBeNull();
    expect(JSON.stringify(writes)).toContain("certificate_retired");
    await expect(loadEsocialCertificate(status.id)).rejects.toThrow("indisponível");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects another secret path or floating alias before reading secret material", async () => {
    const status = await uploadEsocialCertificate(
      admin,
      makeSyntheticA1().pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CNPJ
    );
    const path = `${root}/certificates/${status.id}`;
    const record = db.get(path)!;
    for (const secretVersion of [
      "projects/other/secrets/nai-esocial-a1-test/versions/1",
      "projects/123456789012/secrets/nai-esocial-a1-test/versions/1",
      "projects/synthetic-project/secrets/nai-esocial-a1-other/versions/1",
      `${secret}/versions/latest`,
      `${secret}/versions/../2`,
      `${secret}/versions/0`,
    ]) {
      db.set(path, { ...record, secretVersion });
      await expect(loadEsocialCertificate(status.id)).rejects.toThrow("fora do cofre autorizado");
    }
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("does not call configured a connection with revoked IAM access", async () => {
    await uploadEsocialCertificate(
      admin,
      makeSyntheticA1().pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CNPJ
    );
    mocks.permissions.mockRejectedValue(new Error("denied"));
    expect(await esocialCertificateStatus()).toMatchObject({
      configured: true,
      vaultConfigured: false,
      reason: "Permissão de acesso ao cofre indisponível.",
    });
  });
});

describe("live internal operator authorization", () => {
  it("rechecks an administrator after vault readiness and before creating a secret version", async () => {
    mocks.permissions.mockImplementationOnce(async () => {
      db.set(`users/${admin.uid}`, { role: "OPERATIONS", accessEnabled: true });
      return {
        data: { permissions: ["secretmanager.versions.add", "secretmanager.versions.access"] },
      };
    });
    await expect(
      uploadEsocialCertificate(admin, makeSyntheticA1().pfx, SYNTHETIC_PASSWORD, SYNTHETIC_CNPJ)
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.addVersion).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it.each(["suspended", "downgraded", "removed"])(
    "does not activate a returned secret version after the operator is %s",
    async (change) => {
      const previous = await uploadEsocialCertificate(
        admin,
        makeSyntheticA1().pfx,
        SYNTHETIC_PASSWORD,
        SYNTHETIC_CNPJ
      );
      const pointer = structuredClone(db.get(`${root}/settings/certificate`));
      const previousRecord = structuredClone(db.get(`${root}/certificates/${previous.id}`));
      const addVersion = mocks.addVersion.getMockImplementation()!;
      writes = [];
      mocks.addVersion.mockImplementationOnce(async (args) => {
        const response = await addVersion(args);
        if (change === "removed") db.delete(`users/${admin.uid}`);
        else
          db.set(`users/${admin.uid}`, {
            role: change === "downgraded" ? "OPERATIONS" : "ADMIN",
            accessEnabled: change !== "suspended",
          });
        return response;
      });
      await expect(
        uploadEsocialCertificate(admin, makeSyntheticA1().pfx, SYNTHETIC_PASSWORD, SYNTHETIC_CNPJ)
      ).rejects.toMatchObject({ status: 403 });
      // The provider's already-created version is retained, but no active pointer is changed.
      expect(secrets.size).toBe(2);
      expect(certificateRecords()).toHaveLength(1);
      expect(writes).toHaveLength(0);
      expect(db.get(`${root}/settings/certificate`)).toEqual(pointer);
      expect(db.get(`${root}/certificates/${previous.id}`)).toEqual(previousRecord);
      expect(mocks.send).not.toHaveBeenCalled();
    }
  );
  it("does not retire the active certificate after access is revoked before its transaction", async () => {
    const previous = await uploadEsocialCertificate(
      admin,
      makeSyntheticA1().pfx,
      SYNTHETIC_PASSWORD,
      SYNTHETIC_CNPJ
    );
    const pointer = structuredClone(db.get(`${root}/settings/certificate`));
    const previousRecord = structuredClone(db.get(`${root}/certificates/${previous.id}`));
    const transaction = mocks.transaction.getMockImplementation()!;
    writes = [];
    mocks.transaction.mockImplementationOnce((run) => {
      db.set(`users/${admin.uid}`, { role: "ADMIN", accessEnabled: false });
      return transaction(run);
    });
    await expect(retireEsocialCertificate(admin)).rejects.toMatchObject({ status: 403 });
    expect(writes).toHaveLength(0);
    expect(db.get(`${root}/settings/certificate`)).toEqual(pointer);
    expect(db.get(`${root}/certificates/${previous.id}`)).toEqual(previousRecord);
  });
  it("rereads authorization and rejects suspended, missing or downgraded administrators before any secret API", async () => {
    for (const profile of [
      undefined,
      { role: "ADMIN", accessEnabled: false },
      { role: "OPERATIONS", accessEnabled: true },
    ]) {
      if (profile) db.set(`users/${admin.uid}`, profile);
      else db.delete(`users/${admin.uid}`);
      await expect(
        uploadEsocialCertificate(admin, makeSyntheticA1().pfx, SYNTHETIC_PASSWORD, SYNTHETIC_CNPJ)
      ).rejects.toMatchObject({ status: 403 });
    }
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(mocks.addVersion).not.toHaveBeenCalled();
  });
  it("forbids client tenant accounts and limits internal operators to assigned companies", async () => {
    const external = { ...admin, tenantId: "CLIENT" };
    expect(canManageEsocialConnection(external)).toBe(false);
    expect(() => requireEsocialMessagingAccess(external, "CLIENT")).toThrow();
    const scoped: AuthContext = { ...admin, role: "OPERATIONS", servedCompanies: ["CLIENT_A"] };
    expect(() => requireEsocialMessagingAccess(scoped, "CLIENT_A")).not.toThrow();
    expect(() => requireEsocialMessagingAccess(scoped, "CLIENT_B")).toThrow();
    db.set(`users/${admin.uid}`, { role: "OPERATIONS", servedCompanies: ["CLIENT_B"] });
    await expect(currentEsocialUser(scoped, "CLIENT_A")).rejects.toMatchObject({ status: 403 });
  });
  it("rejects path traversal, reserved IDs and non-string document identifiers", () => {
    for (const input of ["../private", ".", "..", "all", "", "a/b", "x\u0000", 9]) {
      expect(() => esocialDocumentId(input as string)).toThrow();
    }
  });
});
