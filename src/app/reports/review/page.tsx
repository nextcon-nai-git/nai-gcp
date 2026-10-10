"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useSgi } from "@/contexts/sgi-context";
import { getActionIdToken } from "@/lib/auth/action-token";
import { processarRelatorioSST, type AnaliseRiscoOutput } from "@/actions/sst-report-processor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ReviewPage() {
  const { activeClientId, isLoading } = useSgi();
  return <VisitForm key={activeClientId} companyId={activeClientId} loadingClient={isLoading} />;
}
function VisitForm({ companyId, loadingClient }: { companyId: string; loadingClient: boolean }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; analysis: AnaliseRiscoOutput } | null>(null);
  const submitting = useRef(false);
  const hasClient = !!companyId && !["all", "unauthorized"].includes(companyId);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !hasClient || result) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await processarRelatorioSST(
        { companyId, title, content },
        await getActionIdToken()
      );
      if (!response.sucesso || !response.relatorioId || !response.analise) {
        setError(response.erro || "Não foi possível salvar o relatório.");
        return;
      }
      setResult({ id: response.relatorioId, analysis: response.analise });
    } catch {
      setError("Não foi possível processar o relatório. Confira sua sessão e o acesso ao cliente.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <Button asChild variant="outline">
        <Link href="/reports">Voltar aos relatórios</Link>
      </Button>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-primary">Relatório de visita técnica</h1>
        <p className="text-muted-foreground">
          Registre as observações da visita. A NAI gera um rascunho para revisão pelo profissional
          responsável.
        </p>
      </header>
      {!hasClient && (
        <p role="status" className="rounded-xl border p-4">
          Selecione um cliente no seletor do sistema para registrar a visita.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Observações da visita</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <fieldset
              disabled={busy || !!result || !hasClient || loadingClient}
              className="space-y-4 disabled:opacity-60"
            >
              <div className="space-y-2">
                <label htmlFor="visit-title">Título</label>
                <Input
                  id="visit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  minLength={3}
                  maxLength={200}
                  placeholder="Visita à unidade — data e local"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="visit-content">Evidências e observações</label>
                <Textarea
                  id="visit-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  minLength={30}
                  maxLength={30000}
                  rows={12}
                  placeholder="Informe data, local, condições observadas, evidências, limitações e responsáveis. Use apenas informações verificadas."
                />
              </div>
              <Button type="submit">
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}Analisar e salvar rascunho
              </Button>
            </fieldset>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Rascunho salvo — revisão pendente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p role="status">
              Protocolo: {result.id}. Disponível no acervo de relatórios deste cliente.
            </p>
            <p>
              <strong>Risco sugerido:</strong> {result.analysis.nivel_risco_geral}
            </p>
            <p className="whitespace-pre-wrap">{result.analysis.resumo_executivo}</p>
            <ul className="list-disc space-y-2 pl-5">
              {result.analysis.acoes_imediatas_recomendadas.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              A análise não representa auditoria concluída, assinatura técnica ou execução das ações
              sugeridas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
