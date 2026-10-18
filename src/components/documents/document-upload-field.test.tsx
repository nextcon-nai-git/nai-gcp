import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentUploadField, type EmployeeDocument } from "./document-upload-field";
const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  url: vi.fn(),
  ref: vi.fn(),
  toast: vi.fn(),
  profile: {
    role: "SUPER_ADMIN",
    companyId: null as string | null,
    tenantId: null as string | null,
    isUserLoading: false,
  },
  user: { uid: "user-1" } as { uid: string } | null,
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: mocks.user, ...mocks.profile }),
  useStorage: () => ({}),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("firebase/storage", () => ({
  uploadBytes: mocks.upload,
  getDownloadURL: mocks.url,
  ref: mocks.ref,
}));
const original: EmployeeDocument = {
  id: "one",
  name: "existing.pdf",
  category: "RG / CPF",
  url: "https://example.com/a.pdf",
  uploadedAt: "2026-10-18",
};
let container: HTMLDivElement;
let root: Root;
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<any>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
async function render(props: Partial<React.ComponentProps<typeof DocumentUploadField>> = {}) {
  await act(async () => {
    root.render(
      <DocumentUploadField
        employeeId="employee-1"
        companyId="company-1"
        documents={[original]}
        onDocumentsChange={vi.fn()}
        {...props}
      />
    );
  });
}
async function upload(file = new File(["content"], "new.pdf", { type: "application/pdf" })) {
  await act(async () => {
    const input = container.querySelector("input")!;
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.user = { uid: "user-1" };
  mocks.profile = { role: "SUPER_ADMIN", companyId: null, tenantId: null, isUserLoading: false };
  mocks.upload.mockResolvedValue({ ref: {} });
  mocks.url.mockResolvedValue("https://example.com/new.pdf");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
describe("employee document persistence", () => {
  it("does not add an attachment or report success after Storage fails", async () => {
    const save = vi.fn();
    mocks.upload.mockRejectedValue(new Error("offline"));
    await render({ onDocumentsChange: save });
    await upload();
    expect(save).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("new.pdf");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
  it("waits for metadata persistence before showing the attachment", async () => {
    const pending = deferred();
    const save = vi.fn(() => pending.promise);
    await render({ onDocumentsChange: save });
    await upload();
    expect(save).toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("new.pdf");
    await act(async () => pending.resolve(undefined));
    expect(container.textContent).toContain("new.pdf");
    expect(mocks.ref).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^clientes\/company-1\/colaboradores\/employee-1\//)
    );
  });
  it("preserves the list when metadata persistence fails", async () => {
    await render({ onDocumentsChange: vi.fn().mockRejectedValue(new Error("denied")) });
    await upload();
    expect(container.textContent).toContain("existing.pdf");
    expect(container.textContent).not.toContain("new.pdf");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
  it("keeps the link when its removal is rejected", async () => {
    await render({ onDocumentsChange: vi.fn().mockRejectedValue(new Error("denied")) });
    await act(async () =>
      (
        container.querySelector(
          '[aria-label="Remover vínculo de existing.pdf"]'
        ) as HTMLButtonElement
      ).click()
    );
    expect(container.textContent).toContain("existing.pdf");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
  it.each([
    new File(["x"], "word.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    new File([], "empty.pdf", { type: "application/pdf" }),
    new File([new Uint8Array(10 * 1024 * 1024)], "large.pdf", { type: "application/pdf" }),
  ])("rejects unsupported or invalid files before upload", async (file) => {
    await render();
    await upload(file);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects missing company scope", async () => {
    await render({ companyId: undefined });
    await upload();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("uses a unique internal draft namespace and reports pending save", async () => {
    await render({ employeeId: undefined, companyId: undefined, internal: true, draft: true });
    await upload();
    expect(mocks.ref).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^internos_nextcon\/colaboradores\/draft_[^/]+\//)
    );
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Anexo preparado" }));
  });
  it.each(["employee", "session"])("ignores a late upload after %s changes", async (change) => {
    const pending = deferred();
    const save = vi.fn();
    mocks.upload.mockReturnValue(pending.promise);
    await render({ onDocumentsChange: save });
    await upload();
    if (change === "session") mocks.user = { uid: "user-2" };
    await render({
      employeeId: change === "employee" ? "employee-2" : "employee-1",
      onDocumentsChange: save,
    });
    await act(async () => pending.resolve({ ref: {} }));
    expect(save).not.toHaveBeenCalled();
    expect(mocks.url).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
  it("disables repeated operations while saving", async () => {
    const pending = deferred();
    mocks.upload.mockReturnValue(pending.promise);
    await render();
    await upload();
    await upload();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(
      (
        container.querySelector(
          '[aria-label="Remover vínculo de existing.pdf"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    await act(async () => pending.reject(new Error("offline")));
  });
  it("does not persist metadata if URL retrieval fails", async () => {
    const save = vi.fn();
    mocks.url.mockRejectedValue(new Error("unavailable"));
    await render({ onDocumentsChange: save });
    await upload();
    expect(save).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
  it("rejects a local URL returned instead of a durable address", async () => {
    const save = vi.fn();
    mocks.url.mockResolvedValue("blob:local-only");
    await render({ onDocumentsChange: save });
    await upload();
    expect(save).not.toHaveBeenCalled();
  });
  it("keeps removal pending until metadata is saved", async () => {
    const pending = deferred();
    const busy = vi.fn();
    await render({ onDocumentsChange: () => pending.promise, onBusyChange: busy });
    await act(async () =>
      (
        container.querySelector(
          '[aria-label="Remover vínculo de existing.pdf"]'
        ) as HTMLButtonElement
      ).click()
    );
    expect(container.textContent).toContain("existing.pdf");
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(busy).toHaveBeenLastCalledWith(true);
    await act(async () => pending.resolve(undefined));
    expect(container.textContent).not.toContain("existing.pdf");
    expect(busy).toHaveBeenLastCalledWith(false);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Vínculo removido" })
    );
  });
  it("hides mutation controls in read-only mode", async () => {
    await render({ readOnly: true });
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector('[aria-label="Remover vínculo de existing.pdf"]')).toBeNull();
  });
  it("preserves a concurrent attachment received while metadata is saving", async () => {
    const pending = deferred();
    const save = () => pending.promise;
    await render({ onDocumentsChange: save });
    await upload();
    await render({
      onDocumentsChange: save,
      documents: [original, { ...original, id: "other", name: "concurrent.pdf" }],
    });
    await act(async () => pending.resolve(undefined));
    expect(container.textContent).toContain("new.pdf");
    expect(container.textContent).toContain("concurrent.pdf");
  });
  it("does not write metadata after leaving during URL retrieval", async () => {
    const pending = deferred();
    const save = vi.fn();
    mocks.url.mockReturnValue(pending.promise);
    await render({ onDocumentsChange: save });
    await upload();
    await render({ employeeId: "other", onDocumentsChange: save });
    await act(async () => pending.resolve("https://example.com/new.pdf"));
    expect(save).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
  it.each(["DOCTOR", "NURSE", "HEALTH_PROFESSIONAL", "PROVIDER", "CLIENT_ADMIN", "OPERATIONS"])(
    "does not offer uploads for %s without permission in both stores",
    async (role) => {
      mocks.profile = { role, companyId: "company-1", tenantId: "company-1", isUserLoading: false };
      await render();
      expect(container.querySelector("input")).toBeNull();
      expect(mocks.upload).not.toHaveBeenCalled();
    }
  );
  it.each([
    ["ADMIN", null, null, false, true],
    ["OPERATIONS", null, null, false, false],
    ["OPERATIONS", null, null, true, true],
    ["ADMIN", "company-1", "company-1", false, true],
    ["ADMIN", "company-2", "company-2", false, false],
    ["ADMIN", "company-1", "company-2", false, false],
    ["ADMIN", "company-1", "company-1", true, false],
  ] as const)(
    "intersects permissions for %s / %s / %s / internal=%s",
    async (role, companyId, tenantId, internal, allowed) => {
      mocks.profile = { role, companyId, tenantId, isUserLoading: false };
      await render({ internal });
      expect(!!container.querySelector("input")).toBe(allowed);
    }
  );
  it("waits for the authorization profile before showing writes", async () => {
    mocks.profile.isUserLoading = true;
    await render();
    expect(container.querySelector("input")).toBeNull();
  });
  it("does not offer writes without an authenticated user", async () => {
    mocks.user = null;
    await render();
    expect(container.querySelector("input")).toBeNull();
  });
});
