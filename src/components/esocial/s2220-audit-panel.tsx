"use client";
import { useState } from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { executeS2220AuditAction } from "@/app/actions/audit-s2220";

import {
  AuditFormFields,
  auditInputFromEvent,
  type AuditActionResult,
} from "@/lib/genkit/s2220-contract";
import { AIProviderSchema, type AIProvider } from "@/lib/genkit/providers";
export function S2220AuditPanel({
  companyId,
  payload,
  cleanPayload,
}: {
  companyId: string;
  payload: Record<string, unknown>;
  cleanPayload: () => Record<string, unknown>;
}) {
  const { user } = useUser();
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    payload: typeof payload;
    provider: AIProvider;
    result: AuditActionResult;
  } | null>(null);
  const result =
    snapshot?.payload === payload && snapshot.provider === provider ? snapshot.result : null;
  async function run() {
    if (busy || !user) return;
    setBusy(true);
    try {
      const parsed = AuditFormFields.safeParse(cleanPayload());
      if (!parsed.success) {
        const fields = Array.from(
          new Set(parsed.error.issues.map((issue) => issue.path.join(".")))
        ).slice(0, 8);
        setSnapshot({
          payload,
          provider,
          result: { success: false, error: "Confira os campos do evento: " + fields.join(", ") },
        });
        return;
      }
      const data = await executeS2220AuditAction(
        await user.getIdToken(),
        companyId,
        auditInputFromEvent(parsed.data, provider)
      );
      setSnapshot({ payload, provider, result: data });
    } catch {
      setSnapshot({
        payload,
        provider,
        result: { success: false, error: "Falha na conexão com a auditoria." },
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset className="space-y-3 rounded-xl border p-4">
      <legend className="px-1 text-sm font-semibold">Auditoria do S-2220</legend>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Provedor inicial
          <select
            className="rounded-md border px-2 py-2"
            value={provider}
            disabled={busy}
            onChange={(e) => setProvider(AIProviderSchema.parse(e.target.value))}
          >
            <option value="gemini">Gemini</option>
            <option value="gpt">GPT</option>
            <option value="claude">Claude</option>
          </select>
        </label>
        <Button type="button" variant="outline" onClick={run} disabled={busy || !user}>
          {busy ? "Auditando…" : "Auditar evento"}
        </Button>
      </div>
      <div aria-live="polite">
        {result &&
          (result.success ? (
            <div className="space-y-2 text-sm">
              <strong>
                {
                  {
                    CONFORME: "Conforme nas verificações locais",
                    ATENCAO: "Atenção",
                    NAO_CONFORME: "Há pendências documentais",
                  }[result.data.statusConformidade]
                }
              </strong>
              <p>Índice de pendências: {result.data.scoreRisco}/100</p>
              <p>
                {result.data.modeloUtilizado
                  ? (result.data.fallbackAcionado ? "Modelo alternativo: " : "Modelo: ") +
                    result.data.modeloUtilizado
                  : "IA indisponível. Verificações locais concluídas."}
              </p>
              {result.data.revisaoMedicaPrioritaria && (
                <p>ASO inapto. Encaminhar para revisão médica prioritária.</p>
              )}
              <ul className="list-disc pl-5">
                {result.data.inconsistenciasDetectadas.map((i, n) => (
                  <li key={n}>
                    {i.descricaoErro} ({i.campo})
                  </li>
                ))}
              </ul>
              <ul className="list-disc pl-5">
                {result.data.recomendacoesCorrecao.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="text-xs">{result.data.escopo}</p>
            </div>
          ) : (
            <p role="alert">
              {result.error} {Object.keys(result.validationErrors || {}).join(", ")}
            </p>
          ))}
      </div>
    </fieldset>
  );
}
