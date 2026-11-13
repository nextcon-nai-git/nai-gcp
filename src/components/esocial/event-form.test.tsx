import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventForm, updateAt, valueAt } from "./event-form";

let host: HTMLDivElement, root: Root;
const save = vi
  .fn<(payload: Record<string, unknown>, reference: string) => Promise<void>>()
  .mockResolvedValue(undefined);
function selectByLabel(label: string) {
  const element = [...host.querySelectorAll("label")].find((item) =>
    item.textContent?.startsWith(label)
  );
  return host.querySelector<HTMLSelectElement>(`#${element?.htmlFor}`)!;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  save.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("formulário de eventos", () => {
  it("não presume tipo de exame, aptidão ou procedimento clínico e oferece os seis formulários", async () => {
    await act(async () =>
      root.render(<EventForm busy={false} onSave={save} onCancel={() => {}} />)
    );
    expect(selectByLabel("Tipo de exame ocupacional").value).toBe("");
    expect(selectByLabel("Resultado do ASO").value).toBe("");
    expect(selectByLabel("Procedimento").value).toBe("");
    const selector = host.querySelector<HTMLSelectElement>(
      '[aria-label="Tipo de evento eSocial"]'
    )!;
    expect(selector.options).toHaveLength(6);
    for (const type of ["S2210", "S2240", "S2221", "S2230", "S3000"]) {
      await act(async () => {
        selector.value = type;
        selector.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(host.querySelectorAll("fieldset").length).toBeGreaterThanOrEqual(2);
      expect(host.textContent).not.toContain("Cole JSON");
    }
  });
  it("limpa o responsável pelo PCMSO ao escolher outro vínculo no formulário", async () => {
    const payload = {
      eventType: "S2220",
      ideEvento: { tpAmb: 2, indRetif: 1 },
      ideEmpregador: { tpInsc: 1, nrInsc: "00000001" },
      ideVinculo: { cpfTrab: "00000000191", matricula: "ANTIGA" },
      aso: {
        dtAso: "2026-01-10",
        tpAso: 1,
        exames: [{ dtExm: "2026-01-10", procRealizado: "0295" }],
        medico: { nmMed: "Examinador teste", nrCrm: "12345", ufCrm: "SP" },
        medicoResp: { nmMed: "Coordenador anterior", nrCrm: "99999", ufCrm: "PR" },
      },
    };
    const employee = {
      id: "novo",
      cpf: "52998224725",
      name: "Pessoa de teste",
      link: { matricula: "NOVA", reference: "Folha", confirmedAt: "2026-01-10" },
    };
    await act(async () =>
      root.render(
        <EventForm
          busy={false}
          initialPayload={payload}
          employees={[employee]}
          onSave={save}
          onCancel={() => {}}
        />
      )
    );
    const picker = host.querySelector<HTMLSelectElement>('[aria-label="Colaborador do evento"]')!;
    await act(async () => {
      picker.value = employee.id;
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      host
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0]).toMatchObject({
      ideVinculo: { cpfTrab: employee.cpf, matricula: "NOVA" },
    });
    expect(save.mock.calls[0][0].aso).not.toHaveProperty("medicoResp");
  });
  it("salva um S-2220 com campos tipados e preserva grupos opcionais ausentes", async () => {
    // Synthetic identifiers chosen only to exercise check digits; no real record is used.
    const payload = {
      eventType: "S2220",
      ideEvento: { tpAmb: 2, indRetif: 1 },
      ideEmpregador: { tpInsc: 1, nrInsc: "00000001" },
      ideVinculo: { cpfTrab: "00000000191", matricula: "FICTICIA-001" },
      aso: {
        dtAso: "2026-01-10",
        tpAso: 1,
        exames: [{ dtExm: "2026-01-10", procRealizado: "0295" }],
        medico: { nmMed: "Médico fictício", nrCrm: "000000", ufCrm: "SP" },
      },
    };
    await act(async () =>
      root.render(
        <EventForm
          initialPayload={payload}
          initialReference="Documento sintético"
          busy={false}
          onSave={save}
          onCancel={() => {}}
        />
      )
    );
    const type = selectByLabel("Tipo de exame ocupacional");
    await act(async () => {
      type.value = "0";
      type.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () =>
      host
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({ aso: { tpAso: 0 } });
    expect(
      (save.mock.calls[0][0] as { aso: Record<string, unknown> }).aso.medicoResp
    ).toBeUndefined();
  });
});

describe("caminhos de campos do formulário", () => {
  it.each([
    "__proto__",
    "__proto__.__naiFormPollution",
    "constructor",
    "constructor.prototype.__naiFormPollution",
    "prototype",
    "aso.__proto__.__naiFormPollution",
    "aso.constructor.prototype.__naiFormPollution",
    "aso.prototype.__naiFormPollution",
    "aso.exames.0.__proto__.__naiFormPollution",
    "aso.exames.0.constructor",
    "aso.exames.0.prototype",
  ])("recusa leitura, gravação e remoção por segmento perigoso: %s", (path) => {
    const payload = { aso: { exames: [{ dtExm: "2026-01-10" }] } };
    const original = structuredClone(payload);
    try {
      expect(() => updateAt(payload, path, "synthetic")).toThrow("Caminho de campo inválido");
      expect(() => updateAt(payload, path, undefined)).toThrow("Caminho de campo inválido");
      expect(() => valueAt(payload, path)).toThrow("Caminho de campo inválido");
      expect(payload).toEqual(original);
      expect(Object.hasOwn(Object.prototype, "__naiFormPollution")).toBe(false);
      expect(Object.hasOwn(Array.prototype, "__naiFormPollution")).toBe(false);
    } finally {
      Reflect.deleteProperty(Object.prototype, "__naiFormPollution");
      Reflect.deleteProperty(Array.prototype, "__naiFormPollution");
    }
  });
  it.each(["", ".aso", "aso.", "aso..tpAso"])("recusa segmentos vazios: %s", (path) => {
    expect(() => updateAt({}, path, "synthetic")).toThrow("Caminho de campo inválido");
    expect(() => valueAt({}, path)).toThrow("Caminho de campo inválido");
  });
  it("não lê propriedades herdadas nem modifica objetos herdados durante a travessia", () => {
    const inherited = { value: "original" };
    const key = "__naiFormInherited";
    Object.defineProperty(Object.prototype, key, {
      value: inherited,
      configurable: true,
      writable: true,
    });
    try {
      expect(valueAt({}, `${key}.value`)).toBeUndefined();
      const result = updateAt({}, `${key}.value`, "local");
      expect(Object.hasOwn(result, key)).toBe(true);
      expect(valueAt(result, `${key}.value`)).toBe("local");
      expect(inherited).toEqual({ value: "original" });
    } finally {
      Reflect.deleteProperty(Object.prototype, key);
    }
  });
  it.each(["local", undefined])(
    "não aciona accessor herdado ao criar um grupo para gravar ou remover: %s",
    (value) => {
      const inherited = { marker: "original" };
      const key = "__naiFormAccessorGroup";
      const getter = vi.fn(() => inherited);
      const setter = vi.fn();
      Object.defineProperty(Object.prototype, key, {
        get: getter,
        set: setter,
        configurable: true,
      });
      try {
        const result = updateAt({}, `${key}.marker`, value);
        expect(getter).not.toHaveBeenCalled();
        expect(setter).not.toHaveBeenCalled();
        expect(inherited).toEqual({ marker: "original" });
        expect(Object.hasOwn(result, key)).toBe(true);
        expect(valueAt(result, key)).not.toBe(inherited);
        expect(valueAt(result, `${key}.marker`)).toBe(value);
      } finally {
        Reflect.deleteProperty(Object.prototype, key);
      }
    }
  );
  it.each([0, false, "local"])("define a folha própria sem invocar setter herdado: %s", (value) => {
    const key = "__naiFormAccessorLeaf";
    const getter = vi.fn(() => "inherited");
    const setter = vi.fn();
    Object.defineProperty(Object.prototype, key, {
      get: getter,
      set: setter,
      configurable: true,
    });
    try {
      const input = { aso: {} };
      const result = updateAt(input, `aso.${key}`, value);
      const group = valueAt(result, "aso") as Record<string, unknown>;
      expect(getter).not.toHaveBeenCalled();
      expect(setter).not.toHaveBeenCalled();
      expect(Object.getOwnPropertyDescriptor(group, key)).toEqual({
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      expect(input).toEqual({ aso: {} });
    } finally {
      Reflect.deleteProperty(Object.prototype, key);
    }
  });
  it("preserva o descritor próprio de length ao atualizar arrays", () => {
    const input = { aso: { exames: [{ dtExm: "2026-01-10" }, { dtExm: "2026-02-10" }] } };
    const result = updateAt(input, "aso.exames.length", 1);
    const items = valueAt(result, "aso.exames");
    expect(items).toEqual([{ dtExm: "2026-01-10" }]);
    expect(Object.getOwnPropertyDescriptor(items, "length")).toEqual({
      value: 1,
      writable: true,
      enumerable: false,
      configurable: false,
    });
    expect(input.aso.exames).toHaveLength(2);
  });
  it("preserva arrays, campos tipados e remoção de opcionais sem modificar a entrada", () => {
    const input = {
      aso: {
        tpAso: 1,
        exames: [{ dtExm: "2026-01-10", procRealizado: "0295" }],
        medicoResp: { nmMed: "Responsável sintético" },
      },
    };
    const original = structuredClone(input);
    const updated = updateAt(input, "aso.exames.0.procRealizado", "0296");
    const removed = updateAt(updated, "aso.medicoResp", undefined);
    expect(valueAt(removed, "aso.exames.0.procRealizado")).toBe("0296");
    expect(valueAt(removed, "aso.tpAso")).toBe(1);
    expect(valueAt(removed, "aso.medicoResp")).toBeUndefined();
    expect(Array.isArray(valueAt(removed, "aso.exames"))).toBe(true);
    expect(input).toEqual(original);
  });
  it("cria grupos e itens de array pelos mesmos caminhos usados no schema", () => {
    const result = updateAt({}, "aso.exames.0.dtExm", "2026-01-10");
    expect(result).toEqual({ aso: { exames: [{ dtExm: "2026-01-10" }] } });
    expect(valueAt(result, "aso.exames.1.dtExm")).toBeUndefined();
  });
});
