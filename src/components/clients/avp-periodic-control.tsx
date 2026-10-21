"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AVP_SOURCE } from "@/lib/avp-source-config";
import { formatBrlCents } from "@/lib/avp-costs";
import type { AvpPeriodicControl, AvpObservedPrice } from "@/lib/avp-periodic-control";

function Price({ price }: { price: AvpObservedPrice }) {
  const color =
    price.cents === null
      ? "bg-slate-700 text-white"
      : price.cents < 4000
        ? "bg-green-100 text-green-900"
        : price.cents < 5000
          ? "bg-yellow-100 text-yellow-950"
          : price.cents <= 6000
            ? "bg-red-100 text-red-900"
            : "bg-purple-100 text-purple-900";
  return (
    <div className="space-y-1 border-b border-border py-2 last:border-0">
      <span className={`inline-block rounded px-2 py-1 text-xs font-bold ${color}`}>
        {price.cents === null ? "Sem preço unitário" : formatBrlCents(price.cents)}
      </span>
      <p className="text-xs">
        {price.service} · {price.evidence}
      </p>
      <p className="text-xs text-muted-foreground">
        {price.date || "Data não informada"} · {price.reference} · {price.match}
      </p>
      {price.notes && <p className="text-xs text-muted-foreground">{price.notes}</p>}
    </div>
  );
}
const selectClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
const cellClass = "p-3 text-left align-top text-sm";

export function AvpPeriodicControlPanel() {
  const { user } = useUser();
  const [snapshot, setSnapshot] = useState<{ owner: string; data: AvpPeriodicControl } | null>(
    null
  );
  const data = snapshot?.owner === user?.uid ? (snapshot?.data ?? null) : null;
  const identity = useRef(user?.uid);
  const generation = useRef(0);
  useLayoutEffect(() => {
    identity.current = user?.uid;
    generation.current++;
  }, [user?.uid]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [view, setView] = useState("cities");
  const [coverage, setCoverage] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [peopleFilter, setPeopleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!user || typeof user.getIdToken !== "function") return;
      const request = ++generation.current;
      const isCurrent = () =>
        !signal?.aborted && identity.current === user.uid && generation.current === request;
      setLoading(true);
      setError("");
      try {
        const token = await user.getIdToken();
        if (!isCurrent()) return;
        const response = await fetch("/api/clients/grupo-avp/periodic-control", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal,
        });
        const result = await response.json();
        if (!isCurrent()) return;
        if (response.status === 401 || response.status === 403) setSnapshot(null);
        if (!response.ok) throw new Error(result.error || "Falha na consulta.");
        setSnapshot({ owner: user.uid, data: result });
      } catch (e) {
        if (isCurrent()) setError(e instanceof Error ? e.message : "Falha na consulta.");
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [user]
  );
  useEffect(() => {
    setSnapshot(null);
    setError("");
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => setPage(0), [city, search, peopleFilter]);
  const matches = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes(
        search
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      );
  const cities = (data?.cities || []).filter(
    (c) =>
      (!city || c.key === city) &&
      matches(`${c.city} ${c.uf}`) &&
      (coverage !== "missing" || c.contracted === 0) &&
      (coverage !== "covered" || c.contracted > 0) &&
      (coverage !== "expensive" || c.above40 > 0)
  );
  const clinics = (data?.clinics || []).filter(
    (c) =>
      (!city || c.cityKey === city) &&
      matches(`${c.name} ${c.cnpj} ${c.city} ${c.uf}`) &&
      (priceFilter !== "above40" || c.prices.some((p) => p.cents !== null && p.cents > 4000)) &&
      (priceFilter !== "missing" || !c.prices.some((p) => p.clinical && p.cents !== null))
  );
  const people = (data?.people || []).filter(
    (p) =>
      (!city || p.cityKey === city) &&
      matches(`${p.name} ${p.city} ${p.unit}`) &&
      (peopleFilter === "all" || p.classification === peopleFilter)
  );
  const selectedCity = useMemo(() => data?.cities.find((c) => c.key === city), [data, city]);
  const exportCities = () => {
    const escape = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^(?=\s*[=+@-])/, "'")
        .replace(/"/g, '""') +
      '"';
    const rows = [
      [
        "Cidade",
        "UF",
        "Pessoas únicas",
        "Cancelados",
        "Conferir convocação",
        "Sem ressalva na fonte",
        "Clínicas com contrato informado",
        "Menor ASO observado R$",
        "Clínicas com algum serviço acima de R$40",
        "Próxima ação",
      ],
      ...cities.map((c) => [
        c.city,
        c.uf,
        c.total,
        c.cancelled,
        c.review,
        c.listed,
        c.contracted,
        c.minClinicalCents === null ? "" : (c.minClinicalCents / 100).toFixed(2).replace(".", ","),
        c.above40,
        c.action,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + rows.map((r) => r.map(escape).join(";")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "AVP_Cobertura_Credenciamento.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="space-y-5" aria-label="Periódicos e rede AVP">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Periódicos e rede AVP</h2>
          <p className="text-sm text-muted-foreground">
            Campanha de 20/10 a 20/11/2026 · cobertura local, conferência da convocação e negociação
            de valores.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? "Consultando..." : "Atualizar controle"}
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`https://docs.google.com/spreadsheets/d/${AVP_SOURCE.spreadsheetId}/edit`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir fonte da operação
            </a>
          </Button>
        </div>
      </div>
      {error && (
        <div role="alert" className="rounded border border-destructive p-4">
          <p>{error}</p>
          {data && (
            <p className="text-sm">
              Mostrando a última consulta bem-sucedida; confira a data abaixo.
            </p>
          )}
        </div>
      )}
      {!data && (
        <p role="status">
          {loading
            ? "Consultando campanha, prestadores e valores..."
            : "Aguardando uma consulta autorizada."}
        </p>
      )}
      {data && (
        <>
          <p className="text-xs text-muted-foreground">
            Consulta: {new Date(data.checkedAt).toLocaleString("pt-BR")} · {data.summary.sourceRows}{" "}
            linhas da campanha, {data.summary.duplicates} repetições de CPF + admissão preservadas
            na fonte.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Pessoas únicas", data.summary.uniquePeople],
              ["Validar convocação", data.summary.review],
              ["Cancelados na fonte", data.summary.cancelled],
              ["Cidades sem contrato informado", data.summary.uncovered],
              ["Clínicas com serviço > R$40", data.summary.above40],
            ].map(([label, value]) => (
              <Card className="p-4" key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </Card>
            ))}
          </div>
          <div className="rounded border border-border bg-muted/30 p-4 text-sm space-y-2">
            <p>
              Contrato ativo é uma informação do cadastro enviado, não comprovação de agenda ou
              tarifa atual. Valores anteriores mantêm serviço, data e evidência; confirme o preço
              específico do periódico antes de agendar.
            </p>
            <p>
              Cancelamentos, duplicidades e indicações de conferência da base do cliente ficam
              separados. Este controle não envia convocações nem altera a fila sincronizada de ASOs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["cities", "Cobertura por cidade"],
              ["clinics", "Clínicas e valores"],
              ["people", "Lista de periódicos"],
            ].map(([value, label]) => (
              <Button
                key={value}
                variant={view === value ? "default" : "outline"}
                onClick={() => setView(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Input
              aria-label="Buscar no controle de periódicos"
              placeholder="Buscar cidade, clínica, CNPJ ou colaborador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <select
              aria-label="Cidade da campanha"
              className={selectClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">Todas as cidades da campanha</option>
              {data.cities.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.city || "Local a confirmar"}/{c.uf || "UF a confirmar"} ({c.total})
                </option>
              ))}
            </select>
          </div>
          {selectedCity && (
            <p className="text-sm">
              <strong>
                {selectedCity.city}/{selectedCity.uf}:
              </strong>{" "}
              {selectedCity.total} pessoas únicas · {selectedCity.cancelled} canceladas ·{" "}
              {selectedCity.review} para conferência · {selectedCity.action}.
            </p>
          )}
          {view === "cities" && (
            <>
              <div className="flex flex-wrap gap-3">
                <select
                  aria-label="Filtrar cobertura"
                  className={selectClass}
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
                >
                  <option value="all">Toda a cobertura</option>
                  <option value="missing">Precisa credenciar</option>
                  <option value="covered">Tem contrato informado</option>
                  <option value="expensive">Algum serviço acima de R$40</option>
                </select>
                <Button variant="outline" onClick={exportCities}>
                  Exportar cobertura CSV
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {cities.length} de {data.summary.cities} municípios · ordem: sem contrato primeiro,
                depois maior volume.
              </p>
              <div className="overflow-auto rounded border">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      {[
                        "Localidade",
                        "Pessoas / conferência",
                        "Rede local",
                        "ASO observado",
                        "Próxima ação",
                      ].map((h) => (
                        <th key={h} className={cellClass}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cities.map((c) => (
                      <tr key={c.key} className="border-t">
                        <td className={cellClass}>
                          <button
                            className="font-bold underline"
                            onClick={() => {
                              setCity(c.key);
                              setView("clinics");
                              setSearch("");
                            }}
                          >
                            {c.city || "Local a confirmar"}/{c.uf || "UF a confirmar"}
                          </button>
                        </td>
                        <td className={cellClass}>
                          {c.total} pessoas
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {c.review} conferir · {c.cancelled} canceladas
                          </span>
                        </td>
                        <td className={cellClass}>
                          {c.contracted
                            ? `${c.contracted} com contrato informado`
                            : "Sem contrato informado"}
                        </td>
                        <td className={cellClass}>
                          {c.minClinicalCents === null
                            ? "Preço a confirmar"
                            : formatBrlCents(c.minClinicalCents)}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {c.above40} clínica(s) com serviço &gt; R$40
                          </span>
                        </td>
                        <td className={cellClass}>{c.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {view === "clinics" && (
            <>
              <select
                aria-label="Filtrar valores das clínicas"
                className={selectClass}
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
              >
                <option value="all">Todos os valores</option>
                <option value="above40">Algum serviço acima de R$40</option>
                <option value="missing">Sem preço de ASO clínico</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {clinics.length} unidades filtradas · {data.summary.providerRows} linhas de
                prestadores consolidadas em {data.summary.clinics} identidades por CNPJ e município.
                Também são exibidas {data.summary.historicalClinics} unidades do histórico e{" "}
                {data.summary.naiClinics} adicionais do cadastro NAI. Endereços e contatos repetidos
                foram preservados.
              </p>
              <div className="overflow-auto rounded border">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      {["Clínica e local", "Cadastro / contato", "Valores observados"].map((h) => (
                        <th key={h} className={cellClass}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clinics.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className={cellClass}>
                          <strong>{c.name}</strong>
                          <p className="text-xs text-muted-foreground">
                            {c.origin === "provider-list"
                              ? "Lista de prestadores enviada"
                              : c.origin === "nai"
                                ? "Cadastro mestre NAI"
                                : "Histórico de valores AVP"}
                          </p>
                          <p>
                            {c.city || "Local a confirmar"}/{c.uf || "UF a confirmar"}
                          </p>
                          <p className="text-xs">CNPJ: {c.cnpj || "A confirmar"}</p>
                          <p className="text-xs">
                            {c.contractConflict
                              ? "Contrato divergente: conferir"
                              : c.contractReported
                                ? "Contrato ativo informado na lista"
                                : "Contrato não confirmado"}
                          </p>
                        </td>
                        <td className={cellClass}>
                          {c.phones.join(" · ") || "Telefone a confirmar"}
                          <p>{c.emails.join(" · ")}</p>
                          {c.addresses.map((a) => (
                            <p className="text-xs text-muted-foreground" key={a}>
                              {a}
                            </p>
                          ))}
                          <p className="text-xs">
                            {c.naiRegistered
                              ? `Cadastro NAI localizado${c.naiActive ? " (ativo)" : " (inativo)"}`
                              : "Cadastro mestre NAI não localizado com CNPJ e município"}
                          </p>
                        </td>
                        <td className={cellClass}>
                          {c.prices.length ? (
                            c.prices.map((p, i) => <Price key={`${p.reference}-${i}`} price={p} />)
                          ) : (
                            <p>Sem preço vinculado. Solicitar cotação do exame periódico.</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!!data.unmatchedPrices.length && (
                <details className="rounded border p-4">
                  <summary className="cursor-pointer font-bold">
                    {data.unmatchedPrices.length} registros de valores anteriores sem vínculo único
                    com os prestadores enviados
                  </summary>
                  <p className="text-sm text-muted-foreground">
                    Visão geral, sem filtro de município: não foram usados para afirmar
                    credenciamento ou atribuir preço a outra unidade.
                  </p>
                  {data.unmatchedPrices
                    .filter(
                      (p) =>
                        matches(`${p.clinic} ${p.city} ${p.cnpj}`) &&
                        (priceFilter !== "above40" || (p.cents !== null && p.cents > 4000))
                    )
                    .map((p, i) => (
                      <div className="mt-3" key={`${p.reference}-${i}`}>
                        <strong className="text-sm">
                          {p.clinic} · {p.city || "Local a confirmar"}/{p.uf || "UF a confirmar"}
                        </strong>
                        <Price price={p} />
                      </div>
                    ))}
                </details>
              )}
            </>
          )}
          {view === "people" && (
            <>
              <select
                aria-label="Filtrar conferência dos periódicos"
                className={selectClass}
                value={peopleFilter}
                onChange={(e) => setPeopleFilter(e.target.value)}
              >
                <option value="all">Todos os registros únicos</option>
                <option value="review">Validar convocação</option>
                <option value="listed">Sem ressalva de conferência na fonte</option>
                <option value="cancelled">Cancelados na fonte</option>
              </select>
              <p className="text-sm">
                {people.length} pessoas filtradas · {data.summary.listed} sem ressalva de
                conferência na fonte.
              </p>
              <div className="overflow-auto rounded border">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      {["Colaborador / unidade", "Cidade", "Situação e conferência", "Contato"].map(
                        (h) => (
                          <th key={h} className={cellClass}>
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {people.slice(page * 50, page * 50 + 50).map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className={cellClass}>
                          <strong>{p.name}</strong>
                          <p className="text-xs">{p.unit}</p>
                          <p className="text-xs text-muted-foreground">
                            Admissão: {p.admission || "A conferir"}
                          </p>
                        </td>
                        <td className={cellClass}>
                          {p.city}/{p.uf}
                        </td>
                        <td className={cellClass}>
                          {p.status}
                          <p className="text-xs">{p.review || "Conferência não informada"}</p>
                          {p.duplicateRows > 0 && (
                            <p className="text-xs font-bold">
                              {p.duplicateRows} repetição(ões) na fonte: revisar linhas{" "}
                              {p.sourceRows.join(", ")}
                            </p>
                          )}
                        </td>
                        <td className={cellClass}>
                          {p.phone || "Telefone não informado"}
                          <p className="text-xs">{p.email}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 items-center">
                <Button
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm">
                  Página {page + 1} de {Math.max(1, Math.ceil(people.length / 50))}
                </span>
                <Button
                  variant="outline"
                  disabled={(page + 1) * 50 >= people.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
