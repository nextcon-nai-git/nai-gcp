"use client";
import { useState } from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { saoPauloDay } from "@/lib/executive-dashboard";
type Report = {
  id: string;
  employeeName: string;
  contractType: string;
  date: string;
  activities: string[];
  reportText: string;
};
export default function DailyActivitiesPage() {
  const { user } = useUser();
  const [name, setName] = useState("");
  const [contract, setContract] = useState("CLT");
  const [date, setDate] = useState(saoPauloDay());
  const [text, setText] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function request(save = false) {
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      const headers = {
        Authorization: `Bearer ${await user.getIdToken()}`,
        "Content-Type": "application/json",
      };
      if (save) {
        const response = await fetch("/api/nxc-team/daily-reports", {
          method: "POST",
          headers,
          body: JSON.stringify({
            employeeName: name,
            contractType: contract,
            date,
            reportText: text,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setMessage("Relato salvo com sucesso.");
      }
      const response = await fetch(`/api/nxc-team/daily-reports?date=${encodeURIComponent(date)}`, {
        headers,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReports(data.reports);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao consultar os registros.");
    } finally {
      setBusy(false);
    }
  }
  const field = "w-full rounded-lg border border-slate-300 bg-white p-3 text-sm";
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 text-slate-800">
      <Link href="/nxc-team" className="text-sm text-teal-700">
        Colaboradores NXC
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">Registro diário de atividades</h1>
        <p className="mt-2 text-slate-500">
          Relatos por colaborador e data. O texto preserva o andamento informado pela equipe.
        </p>
      </header>
      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            Colaborador
            <input
              aria-label="Nome do colaborador"
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Regime
            <select
              aria-label="Regime contratual"
              className={field}
              value={contract}
              onChange={(e) => setContract(e.target.value)}
            >
              <option>CLT</option>
              <option>PJ</option>
            </select>
          </label>
          <label>
            Data das atividades
            <input
              aria-label="Data das atividades"
              type="date"
              className={field}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setReports([]);
                setMessage("");
              }}
            />
          </label>
        </div>
        <label className="block">
          Atividades relatadas
          <textarea
            aria-label="Atividades relatadas"
            className={`${field} mt-2 min-h-64`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Uma atividade por linha, mantendo o status informado."
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy || !user}
            onClick={() => void request(true)}
            className="rounded-xl bg-teal-700 px-5 py-3 text-white disabled:opacity-50"
          >
            Salvar relato diário
          </button>
          <button
            disabled={busy || !user}
            onClick={() => void request()}
            className="rounded-xl border px-5 py-3 disabled:opacity-50"
          >
            Consultar relatos da data
          </button>
        </div>
      </section>
      {message && (
        <p role="status" className="rounded-xl border bg-teal-50 p-4">
          {message}
        </p>
      )}
      {reports.map((report) => (
        <article
          key={report.id}
          className="rounded-2xl border bg-white p-6"
          data-testid="saved-daily-report"
        >
          <header className="mb-5">
            <h2 className="text-2xl font-semibold">{report.employeeName}</h2>
            <p className="mt-1 text-sm text-teal-700">
              {report.contractType} · {report.date.split("-").reverse().join("/")} ·{" "}
              {report.activities.length} atividades registradas
            </p>
          </header>
          <ol className="list-inside list-decimal space-y-3">
            {report.activities.map((item, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-3 leading-relaxed">
                {item}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs text-slate-500">
            Relato informado pela gestão. Não constitui registro de ponto ou confirmação automática
            da conclusão de serviços.
          </p>
        </article>
      ))}
    </main>
  );
}
