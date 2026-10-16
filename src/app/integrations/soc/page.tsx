"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Resource = "companies" | "employees" | "asos" | "runs";
type Row = Record<string, string | number | null>;
type Configuration = {
  companyIds: string[];
  resources: Record<string, { configured: boolean; format: string }>;
};
const labels: Record<Resource, string> = {
  companies: "Empresas",
  employees: "Colaboradores",
  asos: "ASOs emitidos",
  runs: "Monitoramento",
};
const columns: Record<Resource, [string, string][]> = {
  companies: [
    ["id", "Código SOC"],
    ["name", "Empresa"],
    ["active", "Ativo"],
    ["integrationCode", "Código de integração"],
  ],
  employees: [
    ["id", "Código SOC"],
    ["name", "Colaborador"],
    ["registration", "Matrícula"],
    ["status", "Situação"],
    ["unit", "Unidade"],
    ["role", "Cargo"],
    ["review", "Conferência"],
  ],
  asos: [
    ["id", "Ficha"],
    ["employeeId", "Colaborador SOC"],
    ["name", "Nome"],
    ["type", "Tipo de ASO"],
    ["issuedAt", "Emissão"],
    ["recordDate", "Data da ficha"],
  ],
  runs: [
    ["startedAt", "Início"],
    ["source", "Origem"],
    ["resource", "Consulta"],
    ["companyId", "Empresa SOC"],
    ["status", "Resultado"],
    ["code", "Diagnóstico"],
    ["records", "Registros"],
    ["needsReview", "Conferir"],
  ],
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export default function SocPage() {
  const { user } = useUser();
  const identity = useRef(user?.uid);
  identity.current = user?.uid;
  const [config, setConfig] = useState<Configuration | null>(null);
  const [resource, setResource] = useState<Resource>("employees");
  const [companyId, setCompanyId] = useState("");
  const [employeeIds, setEmployeeIds] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [unitFilter, setUnitFilter] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState<Record<string, string>>({});

  useEffect(() => {
    setConfig(null);
    setRows(null);
    setError("");
    setNotice("");
    setCompanyId("");
    setVerified({});
    setUnitFilter("");
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/integrations/soc", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Não foi possível verificar a configuração.");
        if (!cancelled) {
          setConfig(data);
          setCompanyId(data.companyIds[0] || "");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha de configuração.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function clear() {
    setUnitFilter("");
    setRows(null);
    setNotice("");
    setError("");
    setPage(0);
  }
  async function query() {
    if (!user || busy) return;
    const uid = user.uid;
    clear();
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ resource, companyId, start, end, employeeIds });
      const response = await fetch(`/api/integrations/soc?${params}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          (data.code ? `${data.code}: ` : "") + (data.error || "Consulta não concluída.")
        );
      if (identity.current !== uid) return;
      setRows(data.data);
      if (resource !== "runs")
        setVerified((previous) => ({ ...previous, [resource]: data.checkedAt }));
      setNotice(
        resource === "runs"
          ? "Últimas 50 consultas registradas no NAI. Não inclui logs de outros integradores."
          : `Consulta respondida pelo SOC em ${new Date(data.checkedAt).toLocaleString("pt-BR")}. ${data.recorded ? "Resumo registrado." : "O resumo não pôde ser registrado no monitoramento."}`
      );
    } catch (e) {
      if (identity.current === uid)
        setError(e instanceof Error ? e.message : "Consulta não concluída.");
    } finally {
      setBusy(false);
    }
  }
  const ready = resource === "runs" || !!config?.resources[resource]?.configured;
  const units =
    resource === "employees"
      ? [
          ...new Map(
            (rows || []).filter((r) => r.unitId).map((r) => [String(r.unitId), String(r.unit)])
          ).entries(),
        ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      : [];
  const visibleRows =
    resource === "employees" && unitFilter
      ? (rows || []).filter((r) => r.unitId === unitFilter)
      : rows || [];
  return (
    <main className="space-y-6 pb-16">
      <header className="space-y-2">
        <Link href="/integrations" className="text-sm underline">
          Integrações
        </Link>
        <h1 className="text-3xl font-semibold text-primary">Central SOC</h1>
        <p className="text-muted-foreground">
          Consulte cadastros e ASOs emitidos e acompanhe as consultas realizadas pelo NAI.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Conexão e escopo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {config ? (
            Object.entries(config.resources).map(([key, value]) => (
              <p key={key}>
                {labels[key as Resource]}:{" "}
                <strong>
                  {verified[key]
                    ? `Resposta recebida neste acesso em ${new Date(verified[key]).toLocaleString("pt-BR")}`
                    : value.configured
                      ? "Credenciais configuradas; consulta real pendente"
                      : "Configuração pendente"}
                </strong>
              </p>
            ))
          ) : (
            <p>
              {user ? "Aguardando verificação da configuração." : "Entre no NAI para consultar."}
            </p>
          )}
          <p>A credencial de login no SOC é diferente da chave de cada Exporta Dados.</p>
        </CardContent>
      </Card>
      <nav aria-label="Consultas SOC" className="flex flex-wrap gap-2">
        {Object.entries(labels).map(([key, label]) => (
          <Button
            disabled={busy}
            key={key}
            variant={resource === key ? "default" : "outline"}
            onClick={() => {
              setResource(key as Resource);
              clear();
            }}
          >
            {label}
          </Button>
        ))}
      </nav>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <fieldset disabled={busy} className="flex flex-wrap items-end gap-4">
            {["employees", "asos"].includes(resource) && (
              <label className="space-y-2 text-sm">
                Empresa SOC
                <select
                  className="block h-10 rounded-md border bg-background px-3"
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    clear();
                  }}
                >
                  <option value="">Selecione</option>
                  {config?.companyIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {resource === "asos" && (
              <>
                <label className="space-y-2 text-sm">
                  Códigos SOC dos colaboradores
                  <Input
                    value={employeeIds}
                    onChange={(e) => {
                      setEmployeeIds(e.target.value);
                      clear();
                    }}
                    placeholder="Códigos separados por vírgula"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  Emissão inicial
                  <Input
                    type="date"
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value);
                      clear();
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  Emissão final
                  <Input
                    type="date"
                    value={end}
                    onChange={(e) => {
                      setEnd(e.target.value);
                      clear();
                    }}
                  />
                </label>
              </>
            )}
            <Button disabled={!user || !ready || busy} onClick={query}>
              {busy
                ? "Consultando…"
                : resource === "runs"
                  ? "Atualizar monitoramento"
                  : "Consultar SOC"}
            </Button>
          </fieldset>
          {!ready && (
            <p className="text-sm">
              Configure a chave deste relatório e as empresas autorizadas no servidor para liberar a
              consulta.
            </p>
          )}
          {resource === "employees" && (
            <p className="text-sm text-muted-foreground">
              Matrículas ausentes ou repetidas são indícios para conferência individual. RG não
              consta neste relatório. Os dados do SOC não comprovam a situação atual no RM.
            </p>
          )}
          {resource === "asos" && (
            <p className="text-sm text-muted-foreground">
              Até 50 colaboradores e 31 dias por consulta. Tipos: 1 Admissional · 2 Periódico · 3
              Retorno · 4 Mudança de função · 5 Demissional · 6 Monitoração. Esta consulta mostra
              ASOs emitidos; a fila de agendamentos do AVP é independente.
            </p>
          )}
          {resource === "runs" && (
            <p className="text-sm text-muted-foreground">
              O monitoramento diário consulta cadastros das empresas autorizadas quando o agendador
              está configurado. Nenhuma execução diária é presumida a partir da presença das
              credenciais.
            </p>
          )}
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {rows !== null && (
        <section className="space-y-3">
          <p className="text-sm">
            {visibleRows.length} registros exibidos de {rows.length} consultados.
          </p>
          {resource === "employees" && units.length > 0 && (
            <label className="block space-y-2 text-sm">
              Unidade SOC
              <select
                className="block h-10 max-w-full rounded-md border bg-background px-3"
                value={unitFilter}
                onChange={(e) => {
                  setUnitFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todas as unidades ({units.length})</option>
                {units.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name} · código {id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  {columns[resource].map(([key, label]) => (
                    <th key={key} className="p-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.slice(page * 50, (page + 1) * 50).map((row, i) => (
                  <tr key={i} className="border-t">
                    {columns[resource].map(([key]) => (
                      <td className="p-3" key={key}>
                        {row[key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleRows.length > 50 && (
            <div className="flex items-center gap-3">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span>
                Página {page + 1} de {Math.ceil(visibleRows.length / 50)}
              </span>
              <Button
                variant="outline"
                disabled={(page + 1) * 50 >= visibleRows.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </section>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Conferência com RM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Para corrigir RG ou matrícula, confirme empresa, vínculo e código de integração no RM;
            compare com o cadastro SOC; registre o valor correto e a evidência; corrija um registro;
            confira o retorno da próxima carga.
          </p>
          <p>
            Não apague a matrícula usada como identificador do vínculo. O saneamento e a escrita no
            RM/SOC dependem do contrato de integração e ainda não estão habilitados nesta central.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
