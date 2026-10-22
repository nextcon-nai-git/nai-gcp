"use client";

import * as React from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AVP_COST_BANDS,
  avpCostBand,
  avpEvidenceCsv,
  AvpEvidenceSchema,
  type AvpEvidence,
  type AvpPayment,
  type AvpAsoEvidence,
} from "@/lib/avp-evidence";
import { formatBrlCents } from "@/lib/avp-costs";
import { z } from "zod";

type Stored = AvpEvidence & { uploaded?: boolean };
export function AvpEvidencePanel({ kind }: { kind: "payment" | "aso" }) {
  const { user } = useUser();
  return <AvpEvidenceSession key={JSON.stringify([user?.uid, kind])} kind={kind} />;
}
function AvpEvidenceSession({ kind }: { kind: "payment" | "aso" }) {
  const { user } = useUser();
  const [records, setRecords] = React.useState<Stored[]>([]);
  const [pending, setPending] = React.useState<AvpEvidence[]>([]);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [band, setBand] = React.useState("all");
  const [basis, setBasis] = React.useState("unit");
  const [above, setAbove] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const active = React.useRef(true);
  const mutating = React.useRef(false);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const owner = React.useRef(user?.uid);
  const refreshVersion = React.useRef(0);
  React.useLayoutEffect(() => {
    owner.current = user?.uid;
  }, [user?.uid]);
  const api = React.useCallback(
    async (init?: RequestInit, query = "") => {
      if (!user) throw new Error("Entre no NAI para consultar evidências.");
      const token = await user.getIdToken();
      if (!active.current) throw new Error("Sessão encerrada.");
      const response = await fetch("/api/clients/grupo-avp/evidence" + query, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!active.current) throw new Error("Sessão encerrada.");
      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          setRecords([]);
          setPending([]);
        }
        const data = await response.json();
        throw new Error(data.error || "Não foi possível concluir.");
      }
      return response;
    },
    [user]
  );
  const refresh = React.useCallback(async () => {
    const uid = user?.uid;
    const version = ++refreshVersion.current;
    try {
      const loaded: Stored[] = [];
      let cursor: string | null = null;
      const seen = new Set<string>();
      do {
        const data = await (
          await api(undefined, cursor ? "?cursor=" + encodeURIComponent(cursor) : "")
        ).json();
        if (!active.current || owner.current !== uid || refreshVersion.current !== version)
          return false;
        loaded.push(...data.records);
        cursor = data.nextCursor ?? null;
        if (cursor) {
          if (seen.has(cursor)) throw new Error("Paginação inconsistente. Atualize a consulta.");
          seen.add(cursor);
        }
      } while (cursor);
      if (active.current && owner.current === uid && refreshVersion.current === version) {
        setRecords(loaded);
        setMessage("");
      }
      return true;
    } catch (e) {
      if (active.current && owner.current === uid && refreshVersion.current === version)
        setMessage(e instanceof Error ? e.message : "Erro na consulta.");
      return false;
    }
  }, [api, user?.uid]);
  React.useEffect(() => {
    const guard = refreshVersion;
    setRecords([]);
    setPending([]);
    setMessage("");
    if (user) void refresh();
    return () => {
      guard.current++;
    };
  }, [refresh, user]);
  React.useEffect(() => setPage(1), [kind, search, band, basis, above]);
  async function readIndex(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5000000) throw new Error("Índice excede 5 MB.");
      const data = z
        .array(AvpEvidenceSchema)
        .max(3000)
        .parse(JSON.parse(await file.text()).records);
      if (!active.current) return;
      const selection = data.filter((r) => r.kind === kind);
      if (new Set(selection.map((r) => r.id)).size !== selection.length)
        throw new Error("Há IDs repetidos no índice.");
      setPending(selection);
      setMessage(
        `${selection.length} evidências prontas para importar. Nenhum registro foi salvo ainda.`
      );
    } catch (e) {
      if (!active.current) return;
      setPending([]);
      setMessage(e instanceof Error ? e.message : "Índice inválido.");
    }
  }
  async function save() {
    if (!user || mutating.current) return;
    mutating.current = true;
    const uid = user.uid;
    setBusy(true);
    let added = 0,
      unchanged = 0;
    try {
      for (let i = 0; i < pending.length; i += 100) {
        if (!active.current || owner.current !== uid)
          throw new Error("A sessão mudou. Reabra a importação.");
        const result = await (
          await api({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ records: pending.slice(i, i + 100) }),
          })
        ).json();
        if (!active.current) return;
        added += result.added;
        unchanged += result.unchanged;
        setMessage(`${added} salvos; ${unchanged} já existentes.`);
      }
      if (!active.current) return;
      setPending([]);
      if (!active.current) return;
      const refreshed = await refresh();
      if (active.current && owner.current === uid)
        setMessage(
          `Importação confirmada: ${added} salvos; ${unchanged} já existentes.${refreshed ? "" : " Não foi possível atualizar a consulta. Use Atualizar evidências."}`
        );
    } catch (e) {
      if (!active.current) return;
      setMessage(
        `${added} salvos nesta tentativa. ${e instanceof Error ? e.message : "Falha na importação."} O índice pode ser reenviado sem duplicar os registros confirmados.`
      );
    } finally {
      mutating.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function uploadFiles(files: FileList | null) {
    if (!files || !user || mutating.current) return;
    mutating.current = true;
    setBusy(true);
    let saved = 0;
    const failures: string[] = [];
    const uid = user?.uid;
    try {
      for (const file of Array.from(files)) {
        if (!active.current || owner.current !== uid) throw new Error("A sessão mudou.");
        const matches = records.filter(
          (r): r is AvpAsoEvidence & { uploaded?: boolean } =>
            r.kind === "aso" && r.fileName === file.name
        );
        if (!matches.length) {
          failures.push(`${file.name}: sem índice`);
          continue;
        }
        for (const r of matches) {
          try {
            const form = new FormData();
            form.set("id", r.id);
            form.set("file", file);
            await api({ method: "POST", body: form });
            if (!active.current) return;
            saved++;
          } catch (e) {
            failures.push(`${file.name}: ${e instanceof Error ? e.message : "falhou"}`);
          }
        }
        if (!active.current) return;
        setMessage(`${saved} PDFs anexados. ${failures.length} pendências.`);
      }
      if (!active.current) return;
      const refreshed = await refresh();
      if (active.current && owner.current === uid)
        setMessage(
          `${saved} PDFs anexados com confirmação.${failures.length ? " Pendências: " + failures.join("; ") : ""}${refreshed ? "" : " Não foi possível atualizar a consulta. Use Atualizar evidências."}`
        );
    } catch (e) {
      if (!active.current) return;
      setMessage(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      mutating.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function openDocument(id: string, fileName: string) {
    try {
      const blob = await (await api(undefined, "?document=" + id)).blob();
      if (!active.current) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (!active.current) return;
      setMessage(e instanceof Error ? e.message : "Documento indisponível.");
    }
  }
  const payments = records.filter((r): r is AvpPayment => r.kind === "payment");
  const filtered = records
    .filter((r) => {
      if (r.kind !== kind) return false;
      if (
        search &&
        !JSON.stringify(r)
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .includes(
            search
              .normalize("NFD")
              .replace(/\p{Diacritic}/gu, "")
              .toLowerCase()
          )
      )
        return false;
      if (r.kind === "payment") {
        const cents = basis === "unit" ? r.unitCents : r.amountCents;
        if (above && (cents == null || cents <= 4000)) return false;
        if (band !== "all" && avpCostBand(cents) !== band) return false;
      }
      return true;
    })
    .sort((a, b) =>
      a.kind === "payment" && b.kind === "payment"
        ? b.date.localeCompare(a.date)
        : a.kind === "aso" && b.kind === "aso"
          ? a.employee.localeCompare(b.employee)
          : 0
    );
  const visible = filtered.slice((page - 1) * 50, page * 50);
  const confirmed = payments.filter((r) => r.confirmation === "Comprovante" && r.scope === "AVP");
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([avpEvidenceCsv(filtered.filter((r): r is AvpPayment => r.kind === "payment"))], {
        type: "text/csv;charset=utf-8",
      })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Pagamentos-clinicas-AVP.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="space-y-5 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            {kind === "payment" ? "Pagamentos às clínicas" : "ASOs recebidos"}
          </h2>
          <p className="text-sm text-slate-600">
            {kind === "payment"
              ? "Comprovantes e solicitações identificados, com valor total e custo por exame separados."
              : "Evidências documentais recebidas. Retificações e vínculos pendentes permanecem sinalizados."}
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={busy}>
          Atualizar evidências
        </Button>
      </div>
      {kind === "payment" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p>Pagamentos comprovados AVP</p>
              <strong className="text-2xl">{confirmed.length}</strong>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p>Total comprovado AVP</p>
              <strong className="text-2xl">
                {formatBrlCents(confirmed.reduce((s, r) => s + r.amountCents, 0))}
              </strong>
            </div>
            <div className="rounded-xl bg-purple-50 p-4">
              <p>Exames acima de R$ 40</p>
              <strong className="text-2xl">
                {confirmed
                  .filter((r) => r.unitCents != null && r.unitCents > 4000)
                  .reduce((s, r) => s + (r.quantity ?? 0), 0)}
              </strong>
              <p className="text-xs">
                Somente quantidades confirmadas.{" "}
                {
                  confirmed.filter(
                    (r) => r.unitCents != null && r.unitCents > 4000 && r.quantity == null
                  ).length
                }{" "}
                pagamentos acima de R$ 40 com quantidade desconhecida.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(AVP_COST_BANDS).map(([key, b]) => (
              <span
                key={key}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${b.className}`}
              >
                {b.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-600">
            R$ 40 é amarelo; R$ 50 e R$ 60 são vermelhos. O total do lote não é tratado como preço
            de um exame. Registros sem quantidade ou vínculo confirmado exigem conferência.
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Buscar evidência"
          placeholder="Buscar clínica, colaborador ou cidade"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        {kind === "payment" && (
          <>
            <select
              aria-label="Base do semáforo"
              value={basis}
              onChange={(e) => setBasis(e.target.value)}
              className="rounded border p-2"
            >
              <option value="unit">Semáforo por exame</option>
              <option value="total">Semáforo por pagamento total</option>
            </select>
            <select
              aria-label="Faixa de custo"
              value={band}
              onChange={(e) => setBand(e.target.value)}
              className="rounded border p-2"
            >
              <option value="all">Todas as faixas</option>
              {Object.entries(AVP_COST_BANDS).map(([key, b]) => (
                <option key={key} value={key}>
                  {b.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={above} onChange={(e) => setAbove(e.target.checked)} />
              Somente acima de R$ 40
            </label>
            <Button variant="outline" onClick={exportCsv}>
              Exportar pagamentos
            </Button>
          </>
        )}
      </div>
      <p className="text-sm" role="status">
        {message}
      </p>
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-semibold">Importar evidências e anexos</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            Índice de evidências (JSON)
            <input
              type="file"
              accept=".json"
              disabled={busy}
              onChange={(e) => void readIndex(e.target.files?.[0])}
              className="block"
            />
          </label>
          {pending.length > 0 && (
            <>
              <p>
                {pending.length} registros para importar. A reimportação idêntica não duplica os
                registros.
              </p>
              <div className="max-h-40 overflow-auto text-xs">
                {pending.slice(0, 10).map((r) => (
                  <p key={r.id}>
                    {r.kind === "payment"
                      ? `${r.clinic} · ${formatBrlCents(r.amountCents)} · ${r.confirmation}`
                      : `${r.employee} · ${r.company} · ${r.review}`}
                  </p>
                ))}
              </div>
              <Button onClick={() => void save()} disabled={busy}>
                Salvar {pending.length} evidências
              </Button>
            </>
          )}
          {kind === "aso" && (
            <label className="block text-sm">
              Anexar PDFs dos ASOs já indexados
              <input
                type="file"
                accept=".pdf"
                multiple
                disabled={busy}
                onChange={(e) => void uploadFiles(e.target.files)}
                className="block"
              />
            </label>
          )}
        </div>
      </details>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              {(kind === "payment"
                ? [
                    "Semáforo",
                    "Data / clínica",
                    "Cidade / UF",
                    "Colaboradores",
                    "Total",
                    "Qtd.",
                    "Por exame",
                    "Situação / fonte",
                  ]
                : [
                    "Colaborador",
                    "Empresa / exame",
                    "Data do exame",
                    "Recebido",
                    "Situação / fonte",
                    "PDF",
                  ]
              ).map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) =>
              r.kind === "payment" ? (
                <tr key={r.id} className="border-b align-top">
                  <td className="p-3">
                    <span
                      className={`inline-block rounded px-2 py-1 ${AVP_COST_BANDS[avpCostBand(basis === "unit" ? r.unitCents : r.amountCents)].className}`}
                    >
                      {
                        AVP_COST_BANDS[avpCostBand(basis === "unit" ? r.unitCents : r.amountCents)]
                          .label
                      }
                    </span>
                  </td>
                  <td className="p-3">
                    <strong>{r.clinic}</strong>
                    <p>{r.date.split("-").reverse().join("/")}</p>
                  </td>
                  <td className="p-3">
                    {r.city || "A confirmar"} {r.uf}
                  </td>
                  <td className="min-w-48 p-3">{r.employees || "A vincular"}</td>
                  <td className="whitespace-nowrap p-3">{formatBrlCents(r.amountCents)}</td>
                  <td className="p-3">{r.quantity ?? "—"}</td>
                  <td className="whitespace-nowrap p-3">
                    {r.unitCents == null ? "Não apurado" : formatBrlCents(r.unitCents)}
                  </td>
                  <td className="min-w-64 p-3">
                    <strong>
                      {r.confirmation} · {r.scope}
                    </strong>
                    <p className="text-xs break-all">{r.source}</p>
                    <p className="mt-1 text-xs">{r.notes}</p>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="border-b align-top">
                  <td className="p-3 font-semibold">{r.employee}</td>
                  <td className="p-3">
                    {r.company}
                    <p>{r.examType}</p>
                  </td>
                  <td className="p-3">{r.examDate || "Conferir no ASO"}</td>
                  <td className="p-3">{r.receivedDate}</td>
                  <td className="min-w-64 p-3">
                    <strong>{r.review}</strong>
                    <p className="text-xs">{r.source}</p>
                    <p className="text-xs">{r.notes}</p>
                  </td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      disabled={!r.uploaded}
                      onClick={() => void openDocument(r.id, r.fileName)}
                    >
                      {r.uploaded ? "Abrir ASO" : "Pendente de anexo"}
                    </Button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <p className="p-5 text-slate-500">Nenhuma evidência encontrada nesta seleção.</p>
      )}
      <div className="flex items-center justify-between">
        <p>
          {filtered.length} registros · página {page} de{" "}
          {Math.max(1, Math.ceil(filtered.length / 50))}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            disabled={page * 50 >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </section>
  );
}
