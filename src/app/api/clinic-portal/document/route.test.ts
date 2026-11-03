// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

type StoredRecord = Record<string, unknown>;
type Reference = {
  path: string;
  get: () => Promise<{ data: () => StoredRecord | undefined }>;
  collection: (name: string) => {
    doc: () => Reference;
    add: (data: StoredRecord) => Promise<unknown>;
  };
};
type Transaction = {
  get: (ref: Reference) => ReturnType<Reference["get"]>;
  update: (ref: Reference, data: StoredRecord) => void;
  create: (ref: Reference, data: StoredRecord) => void;
};
type TransactionCallback = (tx: Transaction) => Promise<unknown>;

const m = vi.hoisted(() => ({
  verify: vi.fn(),
  auth: vi.fn(),
  get: vi.fn(),
  profile: vi.fn(),
  download: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
  record: {} as StoredRecord,
  profileData: undefined as StoredRecord | undefined,
  source: {} as StoredRecord,
  events: [] as StoredRecord[],
}));

vi.mock("@/lib/firebase-admin", () => {
  const ref = (path: string): Reference => ({
    path,
    get: () => (path.startsWith("users/") ? m.profile(path) : m.get(path)),
    collection: (name: string) => ({
      doc: () => ref(`${path}/${name}/synthetic-event`),
      add: (data: StoredRecord) => m.audit(data),
    }),
  });
  return {
    adminAuth: { verifyIdToken: m.verify },
    adminDb: {
      collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
      doc: ref,
      runTransaction: m.transaction,
    },
  };
});
vi.mock("@/lib/auth/require-auth", () => ({
  extractBearerToken: (req: NextRequest) => req.headers.get("authorization"),
  requireAuth: m.auth,
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        download: () => m.download(path),
        save: (bytes: Buffer, options: unknown) => m.save(path, bytes, options),
        delete: (options: unknown) => m.remove(path, options),
      }),
    }),
  }),
}));
import { GET, POST } from "./route";

const id = "a".repeat(48);
const actor = { uid: "doctor", email: "doctor@example.test", email_verified: true };
const record = {
  ownerUid: "owner",
  sourcePath: "users/owner/asoRequests/request-1",
  state: "awaiting_signature",
  grants: [
    { email: "doctor@example.test", role: "doctor" },
    { email: "reception@example.test", role: "reception" },
  ],
  expiresAt: "2030-01-01T00:00:00Z",
  revoked: false,
  signedDocument: {
    path: "private/file.pdf",
    sha256: createHash("sha256").update("%PDF-synthetic").digest("hex"),
  },
};

const snapshot = (data: StoredRecord | undefined) => ({
  data: () => (data ? structuredClone(data) : undefined),
});

async function executeTransaction(callback: TransactionCallback, commit = true) {
  const writes: { ref: Reference; data: StoredRecord; create?: boolean }[] = [];
  const result = await callback({
    get: (ref) => {
      if (writes.length) throw new Error("Transaction read after write");
      return ref.get();
    },
    update: (ref, data) => writes.push({ ref, data }),
    create: (ref, data) => writes.push({ ref, data, create: true }),
  });
  if (commit) {
    for (const write of writes) {
      if (write.ref.path === `clinic_portal_private/${id}`)
        Object.assign(m.record, structuredClone(write.data));
      else if (write.ref.path === record.sourcePath)
        Object.assign(m.source, structuredClone(write.data));
      else if (write.create) m.events.push(structuredClone(write.data));
    }
  }
  return result;
}

function pendingDocument() {
  m.record = structuredClone(record);
  delete m.record.signedDocument;
}

function req(method: string, auth = true, body?: FormData) {
  return new NextRequest(`https://nai.test/api/clinic-portal/document?id=${id}`, {
    method,
    headers: {
      ...(auth ? { authorization: "token" } : {}),
      ...(body ? { "content-length": "1000" } : {}),
    },
    body,
  });
}

function uploadRequest() {
  const data = new FormData();
  data.set("id", id);
  data.set("attestation", "true");
  data.set("file", new File(["%PDF-".padEnd(150)], "aso.pdf", { type: "application/pdf" }));
  return req("POST", true, data);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CLINIC_PORTAL_ENABLED", "true");
  m.record = structuredClone(record);
  m.profileData = undefined;
  m.source = {};
  m.events = [];
  m.verify.mockResolvedValue(actor);
  m.get.mockImplementation(async () => snapshot(m.record));
  m.profile.mockImplementation(async () => snapshot(m.profileData));
  m.auth.mockResolvedValue({ uid: "doctor", role: "DOCTOR" });
  m.download.mockResolvedValue([Buffer.from("%PDF-synthetic")]);
  m.save.mockResolvedValue(undefined);
  m.remove.mockResolvedValue(undefined);
  m.transaction.mockImplementation(executeTransaction);
});

describe("signed ASO isolation", () => {
  it("denies the cards-only expert even when an old clinical invitation matches the email", async () => {
    m.profileData = { role: "SCOPED_PROVIDER", accessEnabled: true };
    expect((await GET(req("GET"))).status).toBe(403);
    expect((await POST(req("POST"))).status).toBe(403);
    expect(m.download).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });

  it("denies a suspended NAI profile without requiring a profile for external invitees", async () => {
    m.profileData = { role: "DOCTOR", accessEnabled: false };
    expect((await GET(req("GET"))).status).toBe(403);
    expect((await POST(uploadRequest())).status).toBe(403);
    expect(m.download).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
    m.profileData = undefined;
    expect((await GET(req("GET"))).status).toBe(200);
  });

  it("denies deleted profiles even if accessEnabled remains true", async () => {
    m.profileData = { role: "DOCTOR", accessEnabled: true, isDeleted: true };
    expect((await GET(req("GET"))).status).toBe(403);
    expect((await POST(uploadRequest())).status).toBe(403);
    expect(m.download).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("blocks downloads without login and when disabled", async () => {
    expect((await GET(req("GET", false))).status).toBe(401);
    vi.stubEnv("CLINIC_PORTAL_ENABLED", "false");
    expect((await GET(req("GET"))).status).toBe(503);
    expect((await POST(req("POST"))).status).toBe(503);
    expect(m.download).not.toHaveBeenCalled();
  });

  it("allows invited doctor and records a private download without public URLs", async () => {
    const response = await GET(req("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "signed_pdf_read", uid: "doctor" })
    );
  });

  it("blocks altered PDF bytes and never records a successful download", async () => {
    m.download.mockResolvedValue([Buffer.from("%PDF-altered")]);
    const response = await GET(req("GET"));
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("%PDF-altered");
    expect(m.audit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ action: "signed_pdf_integrity_failed", uid: "doctor" })
    );
  });

  it.each([undefined, "", "not-a-sha256", "a".repeat(64)])(
    "blocks missing or divergent document hash (%s)",
    async (sha256) => {
      m.record.signedDocument = { ...record.signedDocument, sha256 };
      expect((await GET(req("GET"))).status).toBe(409);
      expect(m.audit).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: "signed_pdf_read" })
      );
    }
  );

  it("does not report a successful read when storage fails", async () => {
    m.download.mockRejectedValue(new Error("storage unavailable"));
    expect((await GET(req("GET"))).status).toBe(500);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("allows owner operational access to ASO only", async () => {
    m.verify.mockResolvedValue({ uid: "owner", email: "owner@example.test", email_verified: true });
    m.auth.mockResolvedValue({ uid: "owner", role: "OPERATIONS" });
    expect((await GET(req("GET"))).status).toBe(200);
  });

  it("preserves the operational owner's access after an invitation is revoked", async () => {
    m.record.revoked = true;
    m.verify.mockResolvedValue({ uid: "owner", email: "owner@example.test", email_verified: true });
    m.auth.mockResolvedValue({ uid: "owner", role: "OPERATIONS" });
    expect((await GET(req("GET"))).status).toBe(200);
  });

  it.each(["invitation", "profile", "cards-only"])(
    "withholds PDF bytes and a successful-read event after %s revocation during download",
    async (revocation) => {
      m.download.mockImplementationOnce(async () => {
        if (revocation === "invitation") m.record.revoked = true;
        else if (revocation === "profile") m.profileData = { role: "DOCTOR", accessEnabled: false };
        else m.profileData = { role: "SCOPED_PROVIDER", accessEnabled: true };
        return [Buffer.from("%PDF-synthetic")];
      });
      const response = await GET(req("GET"));
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("%PDF-synthetic");
      expect(m.audit).not.toHaveBeenCalled();
    }
  );

  it("does not return an original whose receipt changed during the download", async () => {
    m.download.mockImplementationOnce(async () => {
      m.record.signedDocument = { ...record.signedDocument, path: "another/document.pdf" };
      return [Buffer.from("%PDF-synthetic")];
    });
    const response = await GET(req("GET"));
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("%PDF-synthetic");
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("denies reception, other owners and revoked invited doctor", async () => {
    m.verify.mockResolvedValue({
      uid: "reception",
      email: "reception@example.test",
      email_verified: true,
    });
    m.auth.mockResolvedValue({ uid: "reception", role: "PROVIDER" });
    expect((await GET(req("GET"))).status).toBe(403);
    m.verify.mockResolvedValue(actor);
    m.record.revoked = true;
    m.auth.mockResolvedValue({ uid: "doctor", role: "DOCTOR" });
    expect((await GET(req("GET"))).status).toBe(403);
    expect(m.download).not.toHaveBeenCalled();
  });

  it("rejects oversized files before parsing the multipart body", async () => {
    const r = new NextRequest("https://nai.test/api/clinic-portal/document", {
      method: "POST",
      headers: { authorization: "token", "content-length": "9999999" },
      body: "invalid",
    });
    expect((await POST(r)).status).toBe(413);
    expect(m.save).not.toHaveBeenCalled();
  });

  it.each([undefined, "1"])(
    "bounds the actual upload stream when Content-Length is %s",
    async (length) => {
      const cancel = vi.fn();
      const request = new NextRequest("https://nai.test/api/clinic-portal/document", {
        method: "POST",
        headers: {
          authorization: "token",
          "content-type": "multipart/form-data; boundary=synthetic",
          ...(length ? { "content-length": length } : {}),
        },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(3 * 1024 * 1024));
            controller.enqueue(new Uint8Array(3 * 1024 * 1024));
          },
          cancel,
        }),
        duplex: "half",
      } as ConstructorParameters<typeof NextRequest>[1]);
      const response = await POST(request);
      expect(response.status).toBe(413);
      expect(cancel).toHaveBeenCalledOnce();
      expect(m.save).not.toHaveBeenCalled();
      expect(m.transaction).not.toHaveBeenCalled();
    }
  );

  it("rejects PDFs without the doctor review attestation", async () => {
    const data = new FormData();
    data.set("id", id);
    data.set("file", new File(["%PDF-".padEnd(150)], "aso.pdf", { type: "application/pdf" }));
    expect((await POST(req("POST", true, data))).status).toBe(400);
    expect(m.save).not.toHaveBeenCalled();
  });
});

describe("signed ASO upload receipt and recovery", () => {
  beforeEach(pendingDocument);

  it("accepts a bounded multipart upload without a Content-Length header", async () => {
    const request = uploadRequest();
    request.headers.delete("content-length");
    expect((await POST(request)).status).toBe(200);
    expect(m.save).toHaveBeenCalledOnce();
  });

  it("confirms the persisted receipt without claiming validation of the signature", async () => {
    const response = await POST(uploadRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "ASO recebido para conferência. A assinatura não foi validada automaticamente.",
    });
    expect(m.record.signedDocument).toEqual(
      expect.objectContaining({
        path: m.save.mock.calls[0][0],
        uploadedBy: actor.uid,
        sha256: createHash("sha256").update("%PDF-".padEnd(150)).digest("hex"),
      })
    );
    expect(m.source.clinicPortalStatus).toBe("signed_document_received");
    expect(m.events).toHaveLength(1);
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("recovers a lost commit acknowledgement using only this upload's exact receipt", async () => {
    m.transaction.mockImplementationOnce(async (callback: TransactionCallback) => {
      await executeTransaction(callback);
      throw new Error("commit acknowledgement lost");
    });
    expect((await POST(uploadRequest())).status).toBe(200);
    expect(m.source.clinicPortalStatus).toBe("signed_document_received");
    expect(m.events).toHaveLength(1);
    expect(m.save).toHaveBeenCalledTimes(1);
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("retains the PDF and reports uncertainty when writes were attempted without a receipt", async () => {
    m.transaction.mockImplementationOnce(async (callback: TransactionCallback) => {
      await executeTransaction(callback, false);
      throw new Error("commit outcome unknown");
    });
    const response = await POST(uploadRequest());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("Recebimento não confirmado");
    expect(m.record.signedDocument).toBeUndefined();
    expect(m.source.clinicPortalStatus).toBeUndefined();
    expect(m.events).toHaveLength(0);
    expect(m.save).toHaveBeenCalledTimes(1);
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("retains a committed PDF when reading its receipt is unavailable", async () => {
    m.transaction
      .mockImplementationOnce(executeTransaction)
      .mockRejectedValueOnce(new Error("receipt read unavailable"));
    expect((await POST(uploadRequest())).status).toBe(503);
    expect(m.record.signedDocument).toBeDefined();
    expect(m.source.clinicPortalStatus).toBe("signed_document_received");
    expect(m.remove).not.toHaveBeenCalled();
  });

  it.each([
    ["path", "clinic-portal-private/another/upload.pdf"],
    ["sha256", "b".repeat(64)],
    ["uploadedBy", "another-doctor"],
    ["uploadedAt", "2026-01-01T00:00:00.000Z"],
  ])("does not recover a receipt with a different %s", async (field, value) => {
    m.transaction.mockImplementationOnce(async (callback: TransactionCallback) => {
      await executeTransaction(callback);
      m.record.signedDocument = {
        ...(m.record.signedDocument as StoredRecord),
        [field]: value,
      };
      throw new Error("commit acknowledgement lost");
    });
    expect((await POST(uploadRequest())).status).toBe(503);
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("cleans only the new PDF when the transaction fails before any writes", async () => {
    m.transaction.mockRejectedValueOnce(new Error("transaction never started"));
    expect((await POST(uploadRequest())).status).toBe(500);
    expect(m.remove).toHaveBeenCalledExactlyOnceWith(m.save.mock.calls[0][0], {
      ignoreNotFound: true,
    });
    expect(m.record.signedDocument).toBeUndefined();
    expect(m.source).toEqual({});
  });

  it.each(["competing receipt", "revoked invitation"])(
    "preserves the candidate after a transaction retry observes a %s",
    async (change) => {
      m.transaction.mockImplementationOnce(async (callback: TransactionCallback) => {
        await executeTransaction(callback, false);
        if (change === "revoked invitation") m.record.revoked = true;
        else
          m.record.signedDocument = {
            path: `clinic-portal-private/${id}/another-upload.pdf`,
            sha256: "b".repeat(64),
            uploadedBy: actor.uid,
            uploadedAt: "2026-01-01T00:00:00.000Z",
          };
        return executeTransaction(callback);
      });
      const response = await POST(uploadRequest());
      expect(response.status).toBe(change === "revoked invitation" ? 403 : 503);
      expect(m.source).toEqual({});
      expect(m.events).toHaveLength(0);
      expect(m.remove).not.toHaveBeenCalled();
      if (change === "competing receipt")
        expect(m.record.signedDocument).toMatchObject({
          path: `clinic-portal-private/${id}/another-upload.pdf`,
        });
    }
  );

  it("cleans an unreferenced object after storage failure without attempting a receipt write", async () => {
    m.save.mockRejectedValueOnce(new Error("storage acknowledgement lost"));
    expect((await POST(uploadRequest())).status).toBe(500);
    expect(m.remove).toHaveBeenCalledExactlyOnceWith(m.save.mock.calls[0][0], {
      ignoreNotFound: true,
    });
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.record.signedDocument).toBeUndefined();
  });

  it.each(["invitation", "profile", "cards-only"])(
    "rejects a %s revocation observed after upload, before creating a receipt",
    async (revocation) => {
      m.save.mockImplementationOnce(async () => {
        if (revocation === "invitation") m.record.revoked = true;
        else if (revocation === "profile") m.profileData = { role: "DOCTOR", accessEnabled: false };
        else m.profileData = { role: "SCOPED_PROVIDER", accessEnabled: true };
      });
      expect((await POST(uploadRequest())).status).toBe(403);
      expect(m.record.signedDocument).toBeUndefined();
      expect(m.source).toEqual({});
      expect(m.events).toHaveLength(0);
      expect(m.remove).toHaveBeenCalledExactlyOnceWith(m.save.mock.calls[0][0], {
        ignoreNotFound: true,
      });
    }
  );

  it.each(["invitation", "profile"])(
    "preserves a committed PDF but withholds confirmation after %s revocation",
    async (revocation) => {
      m.transaction.mockImplementationOnce(async (callback: TransactionCallback) => {
        await executeTransaction(callback);
        if (revocation === "invitation") m.record.revoked = true;
        else m.profileData = { role: "DOCTOR", accessEnabled: false };
        throw new Error("commit acknowledgement lost");
      });
      const response = await POST(uploadRequest());
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("ASO recebido");
      expect(m.record.signedDocument).toBeDefined();
      expect(m.source.clinicPortalStatus).toBe("signed_document_received");
      expect(m.events).toHaveLength(1);
      expect(m.remove).not.toHaveBeenCalled();
    }
  );

  it("does not replace or delete the winning PDF when two uploads overlap", async () => {
    const firstStored = deferred();
    const releaseFirst = deferred();
    m.save.mockImplementationOnce(async () => {
      firstStored.resolve();
      await releaseFirst.promise;
    });
    const firstResponse = POST(uploadRequest());
    await firstStored.promise;
    const secondResponse = await POST(uploadRequest());
    const winningReceipt = structuredClone(m.record.signedDocument);
    releaseFirst.resolve();
    expect(secondResponse.status).toBe(200);
    expect((await firstResponse).status).toBe(403);
    expect(m.record.signedDocument).toEqual(winningReceipt);
    expect(m.events).toHaveLength(1);
    expect(m.save).toHaveBeenCalledTimes(2);
    expect(m.remove).toHaveBeenCalledExactlyOnceWith(m.save.mock.calls[0][0], {
      ignoreNotFound: true,
    });
    expect(m.remove.mock.calls[0][0]).not.toBe(m.save.mock.calls[1][0]);
  });
});
