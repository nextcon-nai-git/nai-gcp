import { expect, it } from "vitest";
import { parseExtratoToDre } from "./dre-excel-parser";
it.each(["", "Receita;0", "arquivo inválido", "Despesa;-123,45"])(
  "does not manufacture a DRE from legacy input %s",
  async (input) => {
    const result = await parseExtratoToDre(input, "teste.xlsx");
    expect(result.sucesso).toBe(false);
    expect(result.dados).toBeUndefined();
    expect(result.mensagem).toContain("Omie");
  }
);
