"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { getActionIdToken } from "@/lib/auth/action-token";
import { BRITANIA_TEAM, BRITANIA_ANCHOR, BRITANIA_GROUP_NAME } from "@/lib/britania-group";
import { readBritaniaDossier, type FapDossier } from "@/lib/britania-dossier";
import { ClientDocuments } from "@/components/clients/client-documents";
const panel = "rounded-2xl border border-slate-600 bg-[#102b46] p-5";
const field = "rounded-lg border border-slate-500 bg-[#071d32] p-3 text-white";
export default function BritaniaGroupPage() {
  const { user, role, tenantId, isUserLoading } = useUser();
  const authorized = !!user && !tenantId && ["SUPER_ADMIN", "ADMIN"].includes(role || "");
  return isUserLoading ? (
    <p role="status">Verificando acesso…</p>
  ) : authorized ? (
    <DossierView key={user.uid} />
  ) : (
    <p role="alert">
      O dossiê consolidado de saúde requer acesso administrativo interno. Os acessos por sede
      permanecem nos módulos autorizados.
    </p>
  );
}
function DossierView() {
  const [dossier, setDossier] = useState<FapDossier | null>(null);
  const [preview, setPreview] = useState<FapDossier | null>(null);
  const [zip, setZip] = useState<File | null>(null),
    [csv, setCsv] = useState<File | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [site, setSite] = useState("all");
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const token = await getActionIdToken();
        const response = await fetch("/api/admin/britania-fap", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (alive) setDossier(data.dossier);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Consulta indisponível.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  async function inspect() {
    if (!zip || busy) return;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      setPreview(
        await readBritaniaDossier(
          await zip.arrayBuffer(),
          zip.name,
          csv ? await csv.arrayBuffer() : undefined,
          csv?.name
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pacote inválido.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await getActionIdToken();
      const response = await fetch("/api/admin/britania-fap", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDossier(preview);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Importação não concluída.");
    } finally {
      setBusy(false);
    }
  }
  const cases = dossier?.cases || [];
  const sites = [...new Set(cases.map((c) => c.sourceCnpj))].sort();
  const filtered = cases.filter(
    (c) =>
      (site === "all" || c.sourceCnpj === site) &&
      `${c.name} ${c.key} ${c.registration}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR"))
  );
  return (
    <div className="space-y-6 rounded-2xl bg-[#071d32] p-4 text-white sm:p-8">
      <Link href="/clients" className="underline">
        ← Clientes
      </Link>
      <header>
        <h1 className="text-3xl font-bold">{BRITANIA_GROUP_NAME}</h1>
        <p className="mt-2 text-slate-300">
          Sedes, colaboradores, afastamentos e plano de prevenção do FAP
        </p>
      </header>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Equipe responsável</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {BRITANIA_TEAM.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> · {p.role}
              <p className="text-sm text-slate-300">{p.delivery}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-amber-200">
          A designação técnica não cria login nem amplia acesso a dados clínicos. Causas, nexo e
          aptidão dependem de avaliação profissional.
        </p>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Sedes e documentos</h2>
        <p className="my-3 text-sm">
          Índices, benefícios e vínculos são conferidos por CNPJ. A visão do grupo preserva os
          cadastros de cada sede.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/clients/BRITANIA_JOINVILLE" className="underline">
            Sede Joinville · 0011-29 e acervo
          </Link>
          <Link href="/clients/CLI_BRITANIA" className="underline">
            Sede Curitiba · 0001-57
          </Link>
          <Link href="/clients/76492701000742" className="underline">
            Sede · 0007-42
          </Link>
          <Link href={`/action-plans?company=${BRITANIA_ANCHOR}`} className="underline">
            Cards do programa FAP
          </Link>
        </div>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Importar controle e fichas de registro</h2>
        <p className="my-3 text-sm text-slate-300">
          Selecione o ZIP de fichas e, se disponível, o CSV de controle. Confira a prévia antes de
          salvar. O conteúdo é extraído localmente; salários, filiação, raça e contatos particulares
          não entram no cadastro.
        </p>
        <div className="flex flex-wrap gap-4">
          <label>
            Pacote de colaboradores (ZIP)
            <input
              className="mt-2 block"
              type="file"
              accept=".zip"
              disabled={busy}
              onChange={(e) => {
                setZip(e.target.files?.[0] || null);
                setPreview(null);
              }}
            />
          </label>
          <label>
            Controle FAP (CSV)
            <input
              className="mt-2 block"
              type="file"
              accept=".csv"
              disabled={busy}
              onChange={(e) => {
                setCsv(e.target.files?.[0] || null);
                setPreview(null);
              }}
            />
          </label>
        </div>
        <button className={`${field} mt-4`} disabled={!zip || busy} onClick={inspect}>
          {busy ? "Processando…" : "Conferir pacote"}
        </button>
        {preview && (
          <div className="mt-4">
            <p>
              {preview.cases.length} colaboradores ·{" "}
              {preview.cases.filter((c) => c.hasRegistration).length} fichas ·{" "}
              {preview.cases.reduce((n, c) => n + c.leaves.length, 0)} registros no histórico.
            </p>
            <p>
              Os motivos são transcrições do RH; não equivalem a diagnósticos ou causas confirmadas.
            </p>
            <button className={`${field} mt-3`} disabled={busy} onClick={save}>
              Salvar dossiê conferido no Grupo BRITANIA
            </button>
          </div>
        )}
      </section>
      {error && (
        <p role="alert" className="rounded-xl bg-red-950 p-4">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Carregando dossiê…</p>
      ) : dossier ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Colaboradores no dossiê", cases.length],
              ["Sedes no pacote", sites.length],
              ["Fichas recebidas", cases.filter((c) => c.hasRegistration).length],
              ["Registros de histórico", cases.reduce((n, c) => n + c.leaves.length, 0)],
            ].map(([label, value]) => (
              <div className={panel} key={label}>
                <p className="text-sm">{label}</p>
                <strong className="text-3xl">{value}</strong>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-300">
            Esta é a população do pacote recebido, não o quadro completo de empregados do grupo. Os
            históricos incluem abonos, transferências e outros motivos administrativos. Sem
            CID/laudo, a causa clínica permanece não informada.
          </p>
          <section className={panel}>
            <h2 className="text-xl font-semibold">Colaboradores e afastamentos</h2>
            <div className="my-4 flex flex-wrap gap-3">
              <label>
                Buscar colaborador
                <input
                  className={`${field} ml-2`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, CPF ou matrícula"
                />
              </label>
              <label>
                Sede de origem
                <select
                  className={`${field} ml-2`}
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                >
                  <option value="all">Todas as sedes</option>
                  {sites.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            {filtered.map((c) => (
              <details key={c.key} className="border-t border-slate-600 py-4">
                <summary className="cursor-pointer font-semibold">
                  {c.name} · sede {c.sourceCnpj} ·{" "}
                  {c.hasRegistration ? `${c.leaves.length} registros` : "Ficha pendente"}
                </summary>
                <div className="mt-4 space-y-3 text-sm">
                  <p>
                    Matrícula: {c.registration || "Não informada"} ·{" "}
                    {c.jobTitles.join(" / ") || "Cargo não informado"} ·{" "}
                    {c.department || "Setor não informado"}
                  </p>
                  <p>
                    Admissão: {c.admission || "Não informada"} · Desligamento informado:{" "}
                    {c.termination || "Não informado"}. Conferir vínculos/transferências antes de
                    determinar situação atual.
                  </p>
                  <p>
                    CNPJ da pasta: {c.sourceCnpj} · CNPJ(s) na ficha:{" "}
                    {c.reportedCnpjs.join(", ") || "Pendente"}
                  </p>
                  {c.reportedCnpjs.length > 0 && !c.reportedCnpjs.includes(c.sourceCnpj) && (
                    <p className="text-amber-200">
                      Divergência de CNPJ: conciliar com Leopold Koenig e RH antes de qualquer
                      correção.
                    </p>
                  )}
                  <p>
                    Benefícios do controle: {c.benefits || "Não informados"} · DIB:{" "}
                    {c.dib || "Não informada"} · DDB: {c.ddb || "Não informada"}
                  </p>
                  <p>
                    Alertas da fonte: {c.alerts || "Não informados"} · RH:{" "}
                    {c.rhNotes || "Sem observação"}
                  </p>
                  <p>Fonte: {c.sourcePath}</p>
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr>
                          <th>Início</th>
                          <th>Retorno informado</th>
                          <th>Motivo do RH</th>
                          <th>Triagem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.leaves.map((a, i) => (
                          <tr key={i} className="border-t border-slate-700">
                            <td className="py-2 pr-3">{a.start || "Data inválida"}</td>
                            <td className="pr-3">{a.end || "Não informado"}</td>
                            <td className="pr-3">{a.reason}</td>
                            <td>{a.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    Medidas: peritos revisam evidências clínicas e previdenciárias; Henrique
                    verifica exposição histórica; Leopold concilia base e custos; Felipe valida
                    medidas de engenharia. Priorizar coleta dos documentos ausentes antes de
                    concluir nexo ou contestação.
                  </p>
                </div>
              </details>
            ))}
            {!filtered.length && <p>Nenhum caso corresponde ao filtro.</p>}
          </section>
          <p role="status">
            Dossiê salvo · {dossier.sourceName} · {dossier.cases.length} casos. Histórico e causas
            aguardam validação técnica.
          </p>
        </>
      ) : (
        !loading && (
          <p>
            Nenhum dossiê importado. Os documentos e cards existentes permanecem no acervo da sede
            Joinville.
          </p>
        )
      )}
      <ClientDocuments companyId={BRITANIA_ANCHOR} />
    </div>
  );
}
