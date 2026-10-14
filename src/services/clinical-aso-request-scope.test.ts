import { describe, expect, it } from "vitest";
import { ClinicalAsoRequestScope } from "./clinical-aso-request-scope";

describe("escopo de requisições do fluxo ASO", () => {
  it.each(["GET do original", "POST da revisão"])(
    "descarta %s atrasado após troca de contexto A→B→A",
    async () => {
      const scope = new ClinicalAsoRequestScope();
      scope.update("company-a:doctor-a:appointment-a:aso-a");
      const requestGeneration = scope.capture();
      let resolve!: (value: string) => void;
      const pending = new Promise<string>((done) => (resolve = done));
      const state = { visible: "" };
      const applyResponse = async () => {
        const response = await pending;
        if (scope.isCurrent(requestGeneration)) state.visible = response;
      };
      const applied = applyResponse();
      scope.update("company-b:doctor-b:appointment-b:aso-b");
      scope.update("company-a:doctor-a:appointment-a:aso-a");
      resolve("resposta sensível");
      await applied;
      expect(state.visible).toBe("");
      expect(scope.isCurrent(requestGeneration)).toBe(false);
    }
  );

  it("mantém atual a requisição cujo contexto não mudou", () => {
    const scope = new ClinicalAsoRequestScope();
    scope.update("company-a:doctor-a:appointment-a:aso-a");
    expect(scope.isCurrent(scope.capture())).toBe(true);
  });
});
