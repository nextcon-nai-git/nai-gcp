import { describe, it, expect } from "vitest";
import { normalizeTaskStatus, OPERATIONAL_COLUMNS, SGI_OPERATIONAL_COLUMNS } from "@/types/kanban";

describe("Compliance & Kanban Improvements", () => {
  describe("Taxonomia de Kanban - Normalização de Status", () => {
    it("deve normalizar strings em português e maiúsculas para o status canônico", () => {
      expect(normalizeTaskStatus("PLANEJAMENTO")).toBe("todo");
      expect(normalizeTaskStatus("EXECUÇÃO")).toBe("doing");
      expect(normalizeTaskStatus("execucao")).toBe("doing");
      expect(normalizeTaskStatus("REVISÃO")).toBe("review");
      expect(normalizeTaskStatus("CONCLUÍDO")).toBe("done");
      expect(normalizeTaskStatus("concluido")).toBe("done");
      expect(normalizeTaskStatus("PROPOSTAS")).toBe("to_review");
    });

    it("deve manter status canônicos inalterados", () => {
      expect(normalizeTaskStatus("todo")).toBe("todo");
      expect(normalizeTaskStatus("doing")).toBe("doing");
      expect(normalizeTaskStatus("done")).toBe("done");
      expect(normalizeTaskStatus("review")).toBe("review");
    });

    it("as colunas operacionais devem ter rótulos semânticos corretos", () => {
      const todoCol = OPERATIONAL_COLUMNS.find((c) => c.id === "todo");
      expect(todoCol?.title).toBe("Planejamento");

      const doingCol = OPERATIONAL_COLUMNS.find((c) => c.id === "doing");
      expect(doingCol?.title).toBe("Em Execução");

      const doneCol = OPERATIONAL_COLUMNS.find((c) => c.id === "done");
      expect(doneCol?.title).toContain("Concluído");
    });
  });
});
