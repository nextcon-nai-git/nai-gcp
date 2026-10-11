import { describe, expect, it, vi } from "vitest";
import {
  brazilToday,
  collectTitles,
  dueDate,
  summarizeTitles,
  titlesCsv,
  type Title,
} from "./treasury";
import type { OmiePage } from "./omie";

const title = (id: string, due = "11/10/2026", amount = 10.01): Title => ({
  id,
  dueDate: due,
  amount,
  document: "teste",
  partyCode: "123",
  category: "serviço",
  status: "EMABERTO",
});
const page = (number: number, rows: Title[], total = 2, pages = 2): OmiePage => ({
  page: number,
  rows,
  total,
  pages,
  queriedAt: "2026-10-11T17:00:00Z",
});
describe("agenda financeira com cobertura explícita", () => {
  it("usa o dia de Brasília na virada UTC e rejeita datas impossíveis", () => {
    expect(brazilToday(new Date("2026-10-12T01:00:00Z"))).toBe("2026-10-11");
    expect(dueDate("31/02/2026")).toBeNull();
    expect(dueDate("29/02/2024")).toBe("2024-02-29");
  });
  it("separa vencidos, hoje, 7 e 30 dias e exclui valores e datas inválidos", () => {
    const result = summarizeTitles(
      [
        title("1", "10/10/2026", 0.1),
        title("2", "10/10/2026", 0.2),
        title("3"),
        title("4", "18/10/2026"),
        title("5", "19/10/2026"),
        title("6", "10/11/2026"),
        title("7", "11/11/2026"),
        title("8", "31/02/2026"),
        title("9", "11/10/2026", -1),
      ],
      "2026-10-11"
    );
    expect(result.buckets.map((b) => b.count)).toEqual([2, 1, 1, 2, 1]);
    expect(result.buckets[0].cents).toBe(30);
    expect(result.invalid).toBe(2);
  });
  it("consulta todas as páginas antes de indicar cobertura completa", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page(1, [title("1")]))
      .mockResolvedValueOnce(page(2, [title("2")]));
    const result = await collectTitles(fetch, vi.fn(), new AbortController().signal);
    expect(result.complete).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(fetch.mock.calls).toEqual([[1], [2]]);
  });
  it("não duplica títulos nem apresenta paginação alterada como completa", async () => {
    const duplicate = vi
      .fn()
      .mockResolvedValueOnce(page(1, [title("1")]))
      .mockResolvedValueOnce(page(2, [title("1")]));
    const result = await collectTitles(duplicate, vi.fn(), new AbortController().signal);
    expect(result.complete).toBe(false);
    expect(result.rows).toHaveLength(1);
    const changed = vi
      .fn()
      .mockResolvedValueOnce(page(1, [title("1")]))
      .mockResolvedValueOnce(page(2, [title("2")], 3));
    expect((await collectTitles(changed, vi.fn(), new AbortController().signal)).complete).toBe(
      false
    );
  });
  it("limita consultas e sinaliza cobertura parcial", async () => {
    const result = await collectTitles(
      async () => page(1, [title("1")]),
      vi.fn(),
      new AbortController().signal,
      1
    );
    expect(result.complete).toBe(false);
    expect(result.warning).toContain("parcial");
  });
  it("distingue carteira vazia de falha e respeita cancelamento", async () => {
    expect(
      (await collectTitles(async () => page(1, [], 0, 0), vi.fn(), new AbortController().signal))
        .complete
    ).toBe(true);
    await expect(
      collectTitles(
        async () => {
          throw new Error("indisponível");
        },
        vi.fn(),
        new AbortController().signal
      )
    ).rejects.toThrow("indisponível");
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn();
    await expect(collectTitles(fetch, vi.fn(), controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("exporta centavos e neutraliza fórmulas em campos textuais", () => {
    const csv = titlesCsv([{ ...title("1"), document: '=HYPERLINK("example")' }], "Receber");
    expect(csv).toContain("10,01");
    expect(csv).toContain("'=");
    expect(csv).toContain('""example""');
  });
});
