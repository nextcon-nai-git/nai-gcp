import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderAssessment } from "./provider-assessment";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const saveButton = () =>
  [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Salvar situação")
  )!;

describe("Avaliação do prestador", () => {
  it("permite selecionar de 1 a 5 estrelas sem submeter o formulário de cadastro", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await act(async () =>
      root.render(
        <ProviderAssessment
          initialValues={{ active: false, rating: 1, ratingNote: "Observação preservada" }}
          onSave={save}
        />
      )
    );
    const stars = container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]");
    expect(stars).toHaveLength(5);
    for (const [index, star] of [...stars].entries()) {
      expect(star.type).toBe("button");
      await act(async () => star.click());
      await act(async () => saveButton().click());
      expect(save).toHaveBeenLastCalledWith({
        active: false,
        rating: index + 1,
        ratingNote: "Observação preservada",
      });
    }
    expect(container.querySelector('[role="status"]')?.textContent).toContain("salvas");
  });

  it("inativa o cadastro e mantém a nota, sem informar sucesso quando a gravação falha", async () => {
    const save = vi.fn().mockRejectedValue(new Error("permission-denied"));
    await act(async () =>
      root.render(
        <ProviderAssessment
          initialValues={{ active: true, rating: 1, ratingNote: "Nota interna" }}
          onSave={save}
        />
      )
    );
    await act(async () => {
      const select = container.querySelector("select")!;
      select.value = "inactive";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => saveButton().click());
    expect(save).toHaveBeenCalledWith({ active: false, rating: 1, ratingNote: "Nota interna" });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Não foi possível salvar"
    );
    expect(saveButton().disabled).toBe(false);
  });

  it("exige avaliação explícita quando não há classificação", async () => {
    const save = vi.fn();
    await act(async () =>
      root.render(
        <ProviderAssessment
          initialValues={{ active: true, rating: 0, ratingNote: "" }}
          onSave={save}
        />
      )
    );
    expect(saveButton().disabled).toBe(true);
    expect(container.textContent).toContain("Sem avaliação");
    expect(save).not.toHaveBeenCalled();
  });
});
