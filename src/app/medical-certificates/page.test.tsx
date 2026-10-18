import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: null as any,
  validate: vi.fn(),
  toast: vi.fn(),
  readerError: false,
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/ai/flows/medical-certificate-validator-flow", () => ({
  validateMedicalCertificate: m.validate,
}));
import Page from "./page";
const analysis = {
  authenticity: "inconclusive",
  confidence: 0,
  extractedData: { patientName: "Paciente sintético" },
  redFlags: ["Imagem incompleta"],
  reasoning: "Revisão humana necessária",
};
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  m.validate.mockReset().mockResolvedValue(analysis);
  m.toast.mockReset();
  m.readerError = false;
  vi.stubGlobal(
    "FileReader",
    class {
      result = "data:application/pdf;base64,dGVzdA==";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        if (m.readerError) this.onerror?.();
        else this.onload?.();
      }
    }
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function upload(file = new File(["%PDF-test"], "atestado.pdf", { type: "application/pdf" })) {
  const e = document.querySelector<HTMLInputElement>("#file-upload")!;
  Object.defineProperty(e, "files", { configurable: true, value: [file] });
  await act(async () => e.dispatchEvent(new Event("change", { bubbles: true })));
}
describe("medical certificate triage", () => {
  it("requires an account before reading or sending a document", async () => {
    m.user = null;
    await v.render(<Page />);
    await upload();
    expect(m.validate).not.toHaveBeenCalled();
  });
  it.each(["text/plain", "image/svg+xml", "application/zip"])(
    "rejects unsupported %s without sending data",
    async (type) => {
      await v.render(<Page />);
      await upload(new File(["x"], "file", { type }));
      expect(m.validate).not.toHaveBeenCalled();
      expect(m.toast).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Formato inválido" })
      );
    }
  );
  it("rejects an empty document", async () => {
    await v.render(<Page />);
    await upload(new File([], "empty.pdf", { type: "application/pdf" }));
    expect(m.validate).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Arquivo vazio" }));
  });
  it("rejects oversized documents before reading", async () => {
    await v.render(<Page />);
    const f = new File(["x"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(f, "size", { value: 10 * 1024 * 1024 + 1 });
    await upload(f);
    expect(m.validate).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Arquivo acima de 10 MB" })
    );
  });
  it("submits the original name and account credentials and shows uncertainty", async () => {
    await v.render(<Page />);
    await upload();
    expect(m.validate).toHaveBeenCalledWith({
      fileDataUri: "data:application/pdf;base64,dGVzdA==",
      fileName: "atestado.pdf",
      idToken: "token-a",
    });
    expect(v.container.textContent).toContain("Inconclusivo");
    expect(v.container.textContent).toContain("Paciente sintético");
    expect(v.container.textContent).toContain("Imagem incompleta");
  });
  it.each(["legitimate", "suspicious", "forged"])(
    "presents %s as triage rather than a confirmed fraud finding",
    async (authenticity) => {
      m.validate.mockResolvedValue({ ...analysis, authenticity, redFlags: [] });
      await v.render(<Page />);
      await upload();
      expect(
        m.toast.mock.calls
          .flat()
          .map((x) => JSON.stringify(x))
          .join(" ")
      ).not.toContain("Alerta de Fraude");
      if (authenticity === "legitimate")
        expect(v.container.textContent).toContain("Sem sinais aparentes de adulteração");
    }
  );
  it("reports a read error without starting analysis", async () => {
    m.readerError = true;
    await v.render(<Page />);
    await upload();
    expect(m.validate).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Erro na NAI" }));
  });
  it("blocks concurrent analyses and supports retry after failure", async () => {
    await v.render(<Page />);
    const p = deferred<any>();
    m.validate.mockReturnValueOnce(p.promise);
    await upload();
    await upload();
    expect(m.validate).toHaveBeenCalledOnce();
    await act(async () => p.reject(Error("Service unavailable")));
    await upload();
    expect(m.validate).toHaveBeenCalledTimes(2);
  });
  it("does not transmit credentials resolved after logout", async () => {
    const p = deferred<string>();
    m.user.getIdToken.mockReturnValueOnce(p.promise);
    await v.render(<Page />);
    await upload();
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old"));
    expect(m.validate).not.toHaveBeenCalled();
  });
  it("does not reveal a prior account's late medical result", async () => {
    await v.render(<Page />);
    const p = deferred<any>();
    m.validate.mockReturnValueOnce(p.promise);
    await upload();
    m.user = { uid: "b", getIdToken: vi.fn().mockResolvedValue("b") };
    await v.render(<Page />);
    await act(async () => p.resolve(analysis));
    expect(v.container.textContent).not.toContain("Paciente sintético");
    expect(m.toast).not.toHaveBeenCalled();
  });
});
