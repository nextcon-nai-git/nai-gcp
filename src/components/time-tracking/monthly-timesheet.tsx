"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { collection, doc, query, where } from "firebase/firestore";
import { useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { brasiliaDay, type TimeClockEmployee } from "@/lib/time-tracking";
import {
  hours,
  monthPeriod,
  monthlyRows,
  punchLabels,
  type TimesheetPunch,
} from "@/lib/monthly-timesheet";
import { Button } from "@/components/ui/button";
import styles from "./monthly-timesheet.module.css";

interface Employer {
  name?: string;
  cnpj?: string;
  address?: string;
  cei?: string;
  caepf?: string;
  cno?: string;
}
const subscribeToClient = () => () => undefined;
const missing = "NÃO INFORMADO - regularizar cadastro";
const dateLabel = (date?: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date!.split("-").reverse().join("/") : missing;
export function MonthlyTimesheet({
  employee,
  employeePath,
  rosterReady,
}: {
  employee: TimeClockEmployee | null;
  employeePath: string;
  rosterReady: boolean;
}) {
  const db = useFirestore();
  const [month, setMonth] = React.useState(() => brasiliaDay(new Date()).slice(0, 7));
  const mounted = React.useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false
  );
  const [includeReferences, setIncludeReferences] = React.useState(false);
  const period = monthPeriod(month);
  const employerRef = useMemoFirebase(
    () =>
      db && employee && employeePath.startsWith("companies/")
        ? doc(db, employeePath.split("/").slice(0, 2).join("/"))
        : null,
    [db, employee?.id, employeePath]
  );
  const employer = useDoc<Employer>(employerRef);
  const target = useMemoFirebase(
    () =>
      db && employee && period && rosterReady
        ? query(
            collection(db, employeePath, employee.id, "time_clock_entries"),
            where("date", ">=", period.start),
            where("date", "<", period.next)
          )
        : null,
    [db, employeePath, employee?.id, period?.start, period?.next, rosterReady]
  );
  const result = useCollection<TimesheetPunch>(target);
  const ready =
    !!employee &&
    !!target &&
    !!period &&
    rosterReady &&
    !result.isLoading &&
    !result.error &&
    !employer.isLoading &&
    !employer.error;
  // A tenant's selected company is authoritative; never substitute another employer.
  const company = employerRef
    ? employer.data
    : employee?.employer
      ? { ...employee.employer, name: employee.employer.companyName }
      : null;
  const rows = ready ? monthlyRows(month, result.data || []) : [];
  const schedule = employee?.workSchedule || employee?.schedule;
  const role =
    employee?.job_role?.title || employee?.jobTitle || employee?.jobRole || employee?.role;
  const warnings = [
    !company?.name && "razão social",
    !company?.cnpj && "CNPJ/CPF do empregador",
    !employee?.cpf && "CPF do trabalhador",
    !employee?.admissionDate && "admissão",
    !role && "cargo/função",
    !schedule && "horário contratual",
    !employee?.weeklyHours && "jornada contratual",
  ].filter(Boolean);
  const total = rows.reduce(
    (sum, row) => sum + (row.seconds !== null && !row.night ? row.seconds : 0),
    0
  );
  const sheet = (
    <article className={styles.sheet} aria-label="Relatório mensal de frequência">
      <h2>Relatório mensal de frequência CLT</h2>
      <p>
        <strong>PRELIMINAR - registros internos para conferência.</strong> Não substitui espelho de
        REP/PTRP validado.
      </p>
      {!ready ? (
        <p role="alert">
          Relatório indisponível. Selecione o colaborador e aguarde a consulta autorizada do
          período.
        </p>
      ) : (
        <>
          <dl className={styles.identity}>
            <div>
              <dt>Empregador</dt>
              <dd>{company?.name || missing}</dd>
            </div>
            <div>
              <dt>CNPJ/CPF do empregador</dt>
              <dd>{company?.cnpj || missing}</dd>
            </div>
            <div>
              <dt>CEI / CAEPF / CNO, se houver</dt>
              <dd>
                {[company?.cei, company?.caepf, company?.cno].filter(Boolean).join(" / ") ||
                  "Não informado no cadastro"}
              </dd>
            </div>
            <div>
              <dt>Endereço do empregador</dt>
              <dd>{company?.address || missing}</dd>
            </div>
            <div>
              <dt>Trabalhador</dt>
              <dd>{employee!.name}</dd>
            </div>
            <div>
              <dt>CPF do trabalhador</dt>
              <dd>{employee!.cpf || missing}</dd>
            </div>
            <div>
              <dt>Admissão</dt>
              <dd>{dateLabel(employee!.admissionDate)}</dd>
            </div>
            <div>
              <dt>Cargo/função</dt>
              <dd>{role || missing}</dd>
            </div>
            <div>
              <dt>Horário contratual cadastrado</dt>
              <dd>{schedule || missing}</dd>
            </div>
            <div>
              <dt>Jornada contratual semanal cadastrada</dt>
              <dd>
                {employee!.weeklyHours
                  ? typeof employee!.weeklyHours === "number"
                    ? `${employee!.weeklyHours} h/semana`
                    : employee!.weeklyHours
                  : missing}
              </dd>
            </div>
            <div>
              <dt>Período</dt>
              <dd>
                {dateLabel(period!.start)} a {dateLabel(period!.end)}
              </dd>
            </div>
            <div>
              <dt>Emissão / fuso</dt>
              <dd>
                {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} -
                America/Sao_Paulo
              </dd>
            </div>
          </dl>
          {warnings.length > 0 && (
            <p>
              <strong>Cadastro pendente:</strong> {warnings.join(", ")}.
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Data / dia</th>
                <th>Entrada</th>
                <th>Saída intervalo</th>
                <th>Retorno intervalo</th>
                <th>Saída</th>
                <th>Tempo entre marcações</th>
                <th>Conferência</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>
                    {dateLabel(row.date)}
                    <br />
                    {new Date(`${row.date}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      timeZone: "America/Sao_Paulo",
                    })}
                  </td>
                  {["entrada", "almoco_saida", "almoco_retorno", "saida"].map((type) => (
                    <td key={type}>
                      {row.entries
                        .filter((p) => p.type === type)
                        .map((p) => p.time)
                        .join("; ") || "-"}
                    </td>
                  ))}
                  <td>{row.seconds === null ? "-" : hours(row.seconds)}</td>
                  <td title={row.status}>
                    {!row.entries.length ? "M" : row.seconds === null ? "P" : row.night ? "N" : "D"}
                    {row.entries
                      .filter((p) => !Object.hasOwn(punchLabels, p.type))
                      .map((p) => (
                        <div key={p.id}>
                          Outra marcação: {p.type} {p.time}
                        </div>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <strong>Conferência:</strong> M = sem marcações, conferir escala/ocorrência; P =
            marcações incompletas ou inconsistentes, sem apuração; N = apuração noturna pendente,
            conferir regime e hora reduzida; D = intervalos diurnos calculados, tratamento pendente.
            Os horários nas colunas são os originais salvos.
          </p>
          <p>
            <strong>Total de intervalos diurnos calculáveis:</strong> {hours(total)}. Dias sem
            marcação não foram classificados como faltas, folgas ou feriados. Horas extras,
            tolerâncias, banco de horas, afastamentos e tratamento noturno não foram apurados.
          </p>
          <p>
            <strong>Tratamentos:</strong> inclusões, desconsiderações e pré-assinalações não estão
            implementadas neste relatório. As marcações originais são preservadas; divergências
            exigem conferência no registrador de origem.
          </p>
          <details open className={styles.audit} data-print-details={includeReferences}>
            <summary>Referências dos registros originais - rastreabilidade</summary>
            <ul>
              {rows.flatMap((row) =>
                row.entries.map((p) => (
                  <li key={`${row.date}:${p.id}`}>
                    {dateLabel(row.date)} · {punchLabels[p.type] || p.type} · {p.time} · ID: {p.id}{" "}
                    · Referência: {p.reference || p.hash || "não informada"}
                  </li>
                ))
              )}
            </ul>
          </details>
          <p>
            Origem: {employeePath}/{employee!.id}/time_clock_entries. Este relatório não altera ou
            confirma marcações.
          </p>
          <div className={styles.signatures}>
            <p>
              Ciência do trabalhador (opcional): ____________________
              <br />
              Data: ____/____/________
            </p>
            <p>
              Conferência do responsável: ____________________
              <br />
              Data: ____/____/________
            </p>
          </div>
        </>
      )}
    </article>
  );
  return (
    <section
      className="space-y-4 rounded-2xl border bg-white p-6 text-slate-900"
      aria-label="Folha mensal CLT"
    >
      <h2 className="text-lg font-bold">Folha mensal para impressão</h2>
      <label className="block">
        Competência{" "}
        <input
          className="ml-2 rounded border p-2"
          aria-label="Competência da folha CLT"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <p className="text-sm">
        Confira os dados e o período abaixo antes de imprimir. Este módulo mantém registros
        internos; a regularidade do REP, dos arquivos AFD/AEJ e dos comprovantes deve ser validada
        separadamente.
      </p>
      {!period && <p role="alert">Selecione uma competência válida.</p>}
      {(result.error || employer.error) && (
        <p role="alert">
          Não foi possível carregar a folha. A impressão foi bloqueada; tente novamente.
        </p>
      )}
      {(result.isLoading || employer.isLoading) && (
        <p role="status">Carregando registros do período...</p>
      )}
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={includeReferences}
          onChange={(e) => setIncludeReferences(e.target.checked)}
        />{" "}
        Incluir referências detalhadas dos registros na impressão
      </label>
      <Button disabled={!ready} onClick={() => window.print()}>
        Imprimir folha mensal / Salvar PDF
      </Button>
      {ready && (
        <details>
          <summary>Visualizar relatório mensal</summary>
          {sheet}
        </details>
      )}
      {mounted && createPortal(<div className="clt-timesheet-print">{sheet}</div>, document.body)}
      <style>{` .clt-timesheet-print { display: none; } @media print { @page { size: A4 portrait; margin: 12mm; } body:has(> .clt-timesheet-print) > :not(.clt-timesheet-print) { display: none !important; } body > .clt-timesheet-print { display: block !important; color: black !important; background: white !important; } } `}</style>
    </section>
  );
}
