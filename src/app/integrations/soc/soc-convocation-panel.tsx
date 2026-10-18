"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  importSocConvocation,
  SOC_CONVOCATION_MAX_BYTES,
} from "@/lib/integrations/soc-convocation-import";
import type { SocDashboardSnapshot, SocExamSummary } from "@/lib/integrations/soc-dashboard";

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const endDate = () => {
  const d = new Date(`${today()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
};
const br = (d: string) => d.split("-").reverse().join("/");
export function SocConvocationPanel({
  snapshot,
  canPublish,
  busy,
  onDraft,
  isDraft = false,
}: {
  snapshot: SocDashboardSnapshot;
  canPublish: boolean;
  busy: boolean;
  onDraft: (draft: SocDashboardSnapshot) => void;
  isDraft?: boolean;
}) {
  const [companyId, setCompanyId] = useState("");
  const [reference, setReference] = useState(today);
  const [end, setEnd] = useState(endDate);
  const [complete, setComplete] = useState(false);
  const [preview, setPreview] = useState<SocExamSummary | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const summaries = snapshot.examSummaries ?? [];
  const reset = () => {
    setPreview(null);
    setError("");
    setComplete(false);
  };
  async function read(file?: File) {
    if (!file) return;
    setPreview(null);
    setComplete(false);
    setError("");
    setReading(true);
    try {
      const company = snapshot.activeCompanies.find((c) => c.id === companyId);
      if (!company) throw Error("Selecione a empresa antes de importar.");
      if (reference > today()) throw Error("A data de referência não pode estar no futuro.");
      if (file.size > SOC_CONVOCATION_MAX_BYTES) throw Error("O arquivo excede 16 MB.");
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder("windows-1252").decode(buffer);
      }
      setPreview(
        importSocConvocation(
          text,
          company,
          reference,
          end,
          new Date().toISOString(),
          snapshot.activeCompanies
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o CSV.");
    } finally {
      setReading(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Convocação de exames por cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isDraft && (
          <p role="status" className="text-sm font-medium">
            Prévia não publicada. Revise e confirme a publicação abaixo para salvar estes resumos.
          </p>
        )}
        <p className="text-sm">
          <strong>
            {summaries.length} de {snapshot.activeCompanies.length}
          </strong>{" "}
          empresas com relatório importado. As demais aguardam levantamento.
        </p>
        <p className="text-sm text-muted-foreground">
          Contagens de exames de colaboradores ativos, pela coluna “Refazer em” do SOC. Não são
          contagens de pessoas ou ASOs. Datas ausentes permanecem desconhecidas; pedido de exame não
          comprova realização. Cada linha conserva sua data de referência.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm text-left">
            <caption className="sr-only">Cobertura e vencimentos dos exames importados</caption>
            <thead>
              <tr>
                {[
                  "Cliente",
                  "Referência / prazo",
                  "Exames",
                  "Vencidos",
                  "Vencendo",
                  "Após prazo",
                  "Sem data",
                  "Importado",
                ].map((h) => (
                  <th key={h} className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.companyId} className="border-t">
                  <td className="p-2">
                    {snapshot.activeCompanies.find((c) => c.id === s.companyId)?.name}
                    <p className="font-mono text-xs">{s.companyId}</p>
                  </td>
                  <td className="p-2">
                    {br(s.referenceDate)} até {br(s.dueSoonEnd)}
                  </td>
                  <td className="p-2">{s.total}</td>
                  <td className="p-2 font-semibold text-red-700 dark:text-red-300">{s.overdue}</td>
                  <td className="p-2 font-semibold text-amber-700 dark:text-amber-300">
                    {s.dueSoon}
                  </td>
                  <td className="p-2">{s.later}</td>
                  <td className="p-2">{s.unknown}</td>
                  <td className="p-2">
                    {new Date(s.importedAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!summaries.length && (
          <p className="text-sm">
            Nenhum relatório de convocação importado. Vencimentos ainda não apurados.
          </p>
        )}
        {canPublish && (
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">
              Importar CSV de Convocação de Exames
            </summary>
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                No SOC, exporte Convocação de Exames de uma empresa, com todas as unidades e exames,
                sem filtro de vencimento. A prévia preserva os outros clientes e substitui somente o
                resumo desta empresa. Nomes de colaboradores e resultados clínicos não são enviados
                ao painel.
              </p>
              <fieldset disabled={busy || reading} className="space-y-3">
                <label className="block text-sm">
                  Empresa do relatório
                  <select
                    value={companyId}
                    onChange={(e) => {
                      setCompanyId(e.target.value);
                      reset();
                    }}
                    className="mt-1 block w-full rounded border bg-background p-2"
                  >
                    <option value="">Selecione a empresa pelo código SOC</option>
                    {snapshot.activeCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} · {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Data de referência
                    <Input
                      type="date"
                      value={reference}
                      max={today()}
                      onChange={(e) => {
                        setReference(e.target.value);
                        reset();
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    Vencendo até
                    <Input
                      type="date"
                      value={end}
                      min={reference}
                      onChange={(e) => {
                        setEnd(e.target.value);
                        reset();
                      }}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  CSV original do SOC
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={!companyId}
                    onChange={(e) => {
                      void read(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </fieldset>
              {reading && <p role="status">Conferindo arquivo…</p>}
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
              {preview && (
                <div className="rounded border p-3 space-y-3 text-sm">
                  <p>
                    <strong>Prévia:</strong> {preview.total} exames · {preview.overdue} vencidos ·{" "}
                    {preview.dueSoon} vencendo · {preview.unknown} sem data ·{" "}
                    {preview.excludedInactive} linhas de outras situações excluídas ·{" "}
                    {preview.duplicates} repetições removidas.
                  </p>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={complete}
                      onChange={(e) => setComplete(e.target.checked)}
                    />
                    Conferi a empresa e confirmei que o arquivo cobre todas as suas unidades e
                    exames, sem filtro de vencimento.
                  </label>
                  <Button
                    disabled={!complete || busy}
                    onClick={() => {
                      onDraft({
                        ...snapshot,
                        examSummaries: [
                          ...summaries.filter((s) => s.companyId !== preview.companyId),
                          preview,
                        ],
                      });
                      setPreview(null);
                      setComplete(false);
                    }}
                  >
                    Preparar publicação deste resumo
                  </Button>
                </div>
              )}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
