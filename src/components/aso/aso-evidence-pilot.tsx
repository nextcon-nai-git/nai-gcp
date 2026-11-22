"use client";
import { useState } from "react";
import type { AsoFlowCard } from "@/lib/aso-flow";
import { contactPilotScore, reconcileAsoEvidence } from "@/lib/sst-evidence-pilot";

export function AsoEvidencePilot({ cards, today }: { cards: AsoFlowCard[]; today: string }) {
  const [probability, setProbability] = useState("");
  const [duration, setDuration] = useState("");
  const [calibrated, setCalibrated] = useState(false);
  const results = cards.map((card) => reconcileAsoEvidence(card, today));
  const score = contactPilotScore(
    Number(probability),
    Number(duration),
    calibrated && probability !== ""
  );
  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer font-semibold">
        Conciliação por evidências e piloto de contatos
      </summary>
      <p className="mt-2 text-sm">
        Somente os {cards.length} registros carregados. Não altera status nem envia mensagens.
      </p>
      <dl className="my-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt>ASO recebido com referência</dt>
          <dd>{results.filter((r) => r.received).length}</dd>
        </div>
        <div>
          <dt>ASO revisado na mesma versão</dt>
          <dd>{results.filter((r) => r.reviewed).length}</dd>
        </div>
        <div>
          <dt>Entrega com evidência</dt>
          <dd>{results.filter((r) => r.delivered).length}</dd>
        </div>
        <div>
          <dt>Realização não confirmada</dt>
          <dd>{results.filter((r) => r.attendance === "Realização não confirmada").length}</dd>
        </div>
        <div>
          <dt>Divergências de status/evidência</dt>
          <dd>{results.filter((r) => r.discrepancy).length}</dd>
        </div>
      </dl>
      <p className="text-sm">
        Simulação manual: somente casos previamente elegíveis pelo responsável. Não substitui
        prioridade clínica, prazo legal ou confirmação com a clínica.
      </p>
      <p id="aso-pilot-probability-help" className="mt-2 text-sm">
        O NAI não estima nem valida a probabilidade de falta. O valor é informado pelo operador.
        Use o resultado apenas para simulação. Não automatize contatos, mudanças de agenda ou
        overbooking com base nele.
      </p>
      <div className="my-3 flex flex-wrap gap-3">
        <label className="text-sm">
          Probabilidade de falta (0–1)
          <input
            className="block rounded border p-2"
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={probability}
            aria-describedby="aso-pilot-probability-help"
            onChange={(e) => {
              setProbability(e.target.value);
              setCalibrated(false);
            }}
          />
        </label>
        <label className="text-sm">
          Duração reservada (minutos)
          <input
            className="block rounded border p-2"
            type="number"
            min="1"
            max="1440"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </label>
      </div>
      <label className="text-sm">
        <input
          type="checkbox"
          checked={calibrated}
          onChange={(e) => setCalibrated(e.target.checked)}
        />{" "}
        Probabilidade calibrada e validada para esta população
      </label>
      <p className="mt-2 text-sm" role="status">
        {score === null
          ? "Informe dados válidos e confirme a calibração para simular."
          : `Minutos reservados em risco: ${score.toFixed(2)}. Não representam capacidade recuperável.`}
      </p>
      <p className="mt-2 text-xs">
        Validar prospectivamente: faltas/100 agendamentos, minutos manuais/caso e tempo até ASO
        validado. Não autoriza overbooking.
      </p>
    </details>
  );
}
