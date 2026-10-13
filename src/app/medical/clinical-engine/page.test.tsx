import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ClinicalEnginePage from "./page";

let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ClinicalEnginePage />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const button = (text: string) =>
  [...container.querySelectorAll("button")].find((element) => element.textContent?.includes(text))!;
async function setInput(value: string) {
  const textarea = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      textarea,
      value
    );
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const run = async () => {
  await act(async () => button("Conferir dados informados").click());
};

describe("preliminary clinical-data page", () => {
  it("starts with no patient and labels the example explicitly before summarizing it", async () => {
    expect(container.querySelector("textarea")!.value).toBe("");
    expect(container.textContent).toContain("Revisão profissional pendente");
    expect(container.textContent).not.toContain("Prontuário Gerado");
    await act(async () => button("Carregar exemplo fictício").click());
    expect(container.textContent).toContain("Exemplo fictício para conferência");
    expect(container.querySelectorAll("details")).toHaveLength(0);
    await run();
    expect(container.textContent).toContain("ASA informado: 2");
    expect(container.textContent).toContain("HbA1c informada: 7.1%");
    expect(container.textContent).not.toMatch(
      /Metformina|Proceder com cirurgia|Iniciar monoterapia/
    );
    expect(container.textContent).toContain(
      "Estrutura da entrada conferida; avaliação clínica pendente"
    );
  });

  it("displays missing input as unassessed while retaining the supplied value", async () => {
    await setInput(JSON.stringify({ glicemia_jejum: 135, linhas_ativadas: ["diabetes"] }));
    await run();
    expect(container.textContent).toContain("Não avaliado");
    expect(container.textContent).toContain("Entrada incompleta ou inválida");
    expect(container.querySelector("pre")!.textContent).toBe(
      JSON.stringify({ glicemia_jejum: 135 }, null, 2)
    );
    expect(container.textContent).not.toContain("Rastreio negativo");
  });

  it.each(["{", "null", JSON.stringify({ linhas_ativadas: ["constructor"] })])(
    "clears the previous record before handling invalid input %s",
    async (input) => {
      await setInput(JSON.stringify({ asa_score: 2, linhas_ativadas: ["cirurgia"] }));
      await run();
      expect(container.textContent).toContain("ASA informado: 2");
      await setInput(input);
      expect(container.textContent).not.toContain("ASA informado: 2");
      await run();
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.querySelectorAll("details")).toHaveLength(0);
      expect(container.textContent).not.toContain("ASA informado: 2");
    }
  );

  it("does not present a selection with no lines as an assessment", async () => {
    await setInput(JSON.stringify({ linhas_ativadas: [] }));
    await run();
    expect(container.querySelector('[role="alert"]')!.textContent).toContain("ao menos uma linha");
    expect(container.querySelectorAll("details")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/normalidade|Rastreio negativo/);
  });
});
