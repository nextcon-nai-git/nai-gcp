import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: null as any,
  scope: "a",
  analyze: vi.fn(),
  token: vi.fn(),
  save: vi.fn(),
  toast: vi.fn(),
  geo: vi.fn(),
  images: [] as any[],
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }), useFirestore: () => ({}) }));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({
    activeClientId: m.scope,
    authorizedCompanies: [m.scope],
    canBrowseAllCompanies: false,
  }),
}));
vi.mock("@/hooks/use-company-directory", () => ({
  useCompanyDirectory: () => ({
    data: [
      { id: "a", name: "Empresa sintética A" },
      { id: "b", name: "Empresa sintética B" },
    ],
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: m.token }));
vi.mock("@/lib/offline-storage", () => ({ offlineStorage: { addItem: m.save } }));
vi.mock("@/ai/flows/field-inspection-flow", () => ({ analyzeFieldInspectionPhoto: m.analyze }));
import Page from "./page";
const report = {
  overallSafetyStatus: "ATENCAO",
  safetyIndex: 30,
  inspectionDate: "2026-10-18",
  locationDetected: "Área sintética",
  executiveSummary: "Conferir proteção",
  findings: [
    {
      id: "risk-1",
      severity: "ALTO",
      title: "Risco sintético",
      applicableStandard: "Referência de teste",
      description: "Conferir evidência",
      actionPlan: {
        what: "Corrigir proteção",
        why: "Risco observado",
        where: "Área sintética",
        when: "Após revisão",
        who: "Responsável técnico",
        how: "Conferir no local",
        howMuch: "A estimar",
      },
    },
  ],
};
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "user-a" };
  m.scope = "a";
  m.analyze.mockReset().mockResolvedValue(report);
  m.token.mockReset().mockResolvedValue("token-a");
  m.save.mockReset();
  m.toast.mockReset();
  m.geo.mockReset();
  m.images = [];
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: m.geo },
  });
  vi.stubGlobal(
    "FileReader",
    class {
      result = "data:image/jpeg;base64,dGVzdA==";
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.onload?.();
      }
    }
  );
  vi.stubGlobal(
    "Image",
    class {
      width = 2400;
      height = 1200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        m.images.push(this);
      }
      set src(_v: string) {
        this.onload?.();
      }
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as any);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/jpeg;base64,c21hbGw="
  );
  vi.spyOn(window, "open").mockReturnValue(null);
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function prepare() {
  await v.render(<Page />);
  await v.input('input[placeholder="Ex: Torre 2 - Andaime Fachada Norte"]', "Área de teste");
  await v.input(
    'input[placeholder="Ex: Colaboradores da empreiteira de pintura sem trava-quedas..."]',
    "Observação sintética"
  );
}
async function picture(file = new File(["image"], "foto.jpg", { type: "image/jpeg" })) {
  const el = v.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(el, "files", { configurable: true, value: [file] });
  await act(async () => el.dispatchEvent(new Event("change", { bubbles: true })));
}
describe("field inspection boundaries", () => {
  it("starts without an invented workplace and requires a specific company", async () => {
    m.scope = "all";
    await v.render(<Page />);
    expect(
      v.container.querySelector<HTMLInputElement>(
        'input[placeholder="Ex: Torre 2 - Andaime Fachada Norte"]'
      )!.value
    ).toBe("");
    expect(v.button("Auditar Imagem").disabled).toBe(true);
  });
  it("submits the current company and keeps local data scoped by account and company", async () => {
    await prepare();
    await v.click("Auditar Imagem");
    expect(m.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "Empresa sintética A",
        notes: "Observação sintética",
        location: "Área de teste",
      }),
      "token-a"
    );
    expect(m.save).toHaveBeenCalledWith(
      "FIELD_INSPECTION",
      expect.objectContaining({ companyName: "Empresa sintética A" }),
      { userId: "user-a", companyId: "a" }
    );
    expect(v.container.textContent).toContain("Risco sintético");
  });
  it("does not run a second analysis while one is pending", async () => {
    await prepare();
    const p = deferred<any>();
    m.analyze.mockReturnValueOnce(p.promise);
    await v.click("Auditar Imagem");
    expect(v.button("Analisando").disabled).toBe(true);
    await act(async () => p.resolve(report));
    expect(m.analyze).toHaveBeenCalledOnce();
  });
  it("does not display or store the former company's late analysis", async () => {
    await prepare();
    const p = deferred<any>();
    m.analyze.mockReturnValueOnce(p.promise);
    await v.click("Auditar Imagem");
    m.scope = "b";
    await v.render(<Page />);
    await act(async () => p.resolve(report));
    expect(v.container.textContent).not.toContain("Risco sintético");
    expect(m.save).not.toHaveBeenCalled();
  });
  it("does not transmit after credentials resolve following logout", async () => {
    await prepare();
    const p = deferred<string>();
    m.token.mockReturnValueOnce(p.promise);
    await v.click("Auditar Imagem");
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old"));
    expect(m.analyze).not.toHaveBeenCalled();
  });
  it("retains an analysis if its device-only copy fails, without claiming persistence", async () => {
    await prepare();
    m.save.mockImplementation(() => {
      throw Error("quota");
    });
    await v.click("Auditar Imagem");
    expect(v.container.textContent).toContain("Risco sintético");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Análise concluída; cópia local não salva" })
    );
  });
  it("surfaces a service failure and leaves the form ready for retry", async () => {
    await prepare();
    m.analyze.mockRejectedValueOnce(Error("Indisponível"));
    await v.click("Auditar Imagem");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Erro na vistoria", description: "Indisponível" })
    );
    expect(v.button("Auditar Imagem").disabled).toBe(false);
  });
  it("reads and compresses supported images and removes their preview", async () => {
    await prepare();
    await picture();
    expect(v.container.querySelector("img")!.src).toContain("c21hbGw=");
    await v.click("Remover");
    expect(v.container.querySelector("img")).toBeNull();
  });
  it("rejects unsupported and empty photos before preview", async () => {
    await prepare();
    await picture(new File(["x"], "x.svg", { type: "image/svg+xml" }));
    expect(v.container.querySelector("img")).toBeNull();
    await picture(new File([], "empty.jpg", { type: "image/jpeg" }));
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Foto inválida" }));
  });
  it("advertises the accepted photo formats and explains native mobile conversion", async () => {
    await prepare();
    for (const input of v.container.querySelectorAll('input[type="file"]')) {
      expect(input.getAttribute("accept")).toBe("image/png,image/jpeg,image/webp");
    }
    expect(v.container.textContent).toContain("HEIC/HEIF");
    await picture(new File(["native"], "photo.heic", { type: "image/heic" }));
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Foto inválida" }));
    expect(v.container.querySelector("img")).toBeNull();
  });
  it("includes GPS only after a successful device callback", async () => {
    await prepare();
    await v.click("Obter GPS");
    await act(async () =>
      m.geo.mock.calls[0][0]({ coords: { latitude: -20, longitude: -40, accuracy: 6.5 } })
    );
    await v.click("Auditar Imagem");
    expect(m.analyze.mock.calls[0][0].gpsCoordinates).toEqual({
      latitude: -20,
      longitude: -40,
      accuracy: 7,
    });
  });
  it("handles denied geolocation without inventing coordinates", async () => {
    await prepare();
    await v.click("Obter GPS");
    await act(async () => m.geo.mock.calls[0][1](Error("denied")));
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Permissão de GPS" })
    );
    await v.click("Auditar Imagem");
    expect(m.analyze.mock.calls[0][0].gpsCoordinates).toBeUndefined();
  });
});
