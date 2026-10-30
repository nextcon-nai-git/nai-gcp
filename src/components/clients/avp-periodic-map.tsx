"use client";
import { useMemo, useState } from "react";
import { aggregateAvpLocalities } from "@/lib/avp-geo-data";
import { BRAZIL_STATES_PATHS } from "@/lib/brazil-states-paths";
import { type PeriodicPerson } from "@/lib/avp-periodic-control";
import {
  AVP_PERIODIC_PROGRESS,
  periodicProgress,
  type PeriodicProgress,
} from "@/lib/avp-periodic-status";

export function AvpPeriodicMap({
  people,
  onSelect,
}: {
  people: PeriodicPerson[];
  onSelect: (cityKey: string, progress: PeriodicProgress) => void;
}) {
  const [uf, setUf] = useState("");
  const groups = useMemo(() => {
    const cities = new Map<string, { city: string; uf: string; counts: Record<string, number> }>();
    for (const person of people) {
      const city = cities.get(person.cityKey) || { city: person.city, uf: person.uf, counts: {} };
      const progress = person.progress || periodicProgress(person.status);
      city.counts[progress] = (city.counts[progress] || 0) + 1;
      cities.set(person.cityKey, city);
    }
    return [...cities.entries()].flatMap(([cityKey, city]) =>
      aggregateAvpLocalities([], [{ cidade: city.city, uf: city.uf }]).map((locality) => ({
        ...locality,
        key: cityKey,
        cityKey,
        counts: city.counts,
      }))
    );
  }, [people]);
  const unknown = people.filter(
    (p) => (p.progress || periodicProgress(p.status)) === "unknown"
  ).length;
  const missing = groups.filter((g) => !g.geoKnown);
  const activeUf = groups.some((g) => g.uf === uf) ? uf : "";
  const visible = groups.filter((g) => g.geoKnown && (!activeUf || g.uf === activeUf));
  const focus = visible.length > 0 && (!!activeUf || groups.length === 1);
  const size = focus
    ? Math.max(
        160,
        Math.max(
          Math.max(...visible.map((c) => c.x)) - Math.min(...visible.map((c) => c.x)),
          Math.max(...visible.map((c) => c.y)) - Math.min(...visible.map((c) => c.y))
        ) + 100
      )
    : 800;
  const centerX = focus
    ? (Math.min(...visible.map((c) => c.x)) + Math.max(...visible.map((c) => c.x))) / 2
    : 400;
  const centerY = focus
    ? (Math.min(...visible.map((c) => c.y)) + Math.max(...visible.map((c) => c.y))) / 2
    : 400;
  const scale = size / 800;
  return (
    <section
      className="rounded-xl border bg-card p-4 space-y-3"
      aria-label="Mapa de periódicos AVP"
    >
      <label className="flex items-center gap-2 text-sm">
        UF
        <select
          aria-label="UF do mapa de periódicos"
          value={activeUf}
          onChange={(e) => setUf(e.target.value)}
          className="rounded border bg-background px-3 py-2"
        >
          <option value="">Brasil</option>
          {[...new Set(groups.map((g) => g.uf))].sort().map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-3 text-sm" aria-label="Legenda dos periódicos">
        {Object.entries(AVP_PERIODIC_PROGRESS).map(([key, value]) => (
          <span key={key} className="inline-flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: value.color }}
              aria-hidden="true"
            />
            {value.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`${centerX - size / 2} ${centerY - size / 2} ${size} ${size}`}
        className="mx-auto w-full max-w-[650px]"
        role="group"
        aria-label="Municípios e situações dos periódicos"
      >
        {Object.values(BRAZIL_STATES_PATHS).map((state) => (
          <path
            key={state.sigla}
            d={state.path}
            className="fill-muted stroke-border"
            strokeWidth="1"
          />
        ))}
        {visible.flatMap((city) =>
          Object.entries(AVP_PERIODIC_PROGRESS).map(([key, value], index) => {
            const count = city.counts[key] || 0;
            if (!count) return null;
            const label = `${city.cidade}/${city.uf}: ${count} ${value.label.toLowerCase()}`;
            const select = () => onSelect(city.cityKey, key as PeriodicProgress);
            return (
              <g
                key={`${city.key}-${key}`}
                role="button"
                tabIndex={0}
                aria-label={label}
                className="cursor-pointer outline-none focus:stroke-foreground"
                onClick={select}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select();
                  }
                }}
                transform={`translate(${city.x + (index % 2 ? 11 : -11) * scale},${city.y + (index < 2 ? -11 : 11) * scale}) scale(${scale})`}
              >
                <title>{label}</title>
                <path
                  d="M0 13 C-3 7 -10 3 -10 -3 A10 10 0 1 1 10 -3 C10 3 3 7 0 13Z"
                  fill={value.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
                <text
                  textAnchor="middle"
                  y="0"
                  fontSize="8"
                  fontWeight="bold"
                  fill={key === "cancelled" ? "#1f2937" : "white"}
                  pointerEvents="none"
                >
                  {count}
                </text>
              </g>
            );
          })
        )}
      </svg>
      <p className="text-xs text-muted-foreground">
        Referências municipais aproximadas. Selecione um marcador para abrir os registros. Em
        contato permanece em vermelho até o agendamento.
      </p>
      {unknown > 0 && (
        <p role="alert" className="text-sm">
          {unknown} registros com status desconhecido ou conflitante: confira na lista; não
          receberam cor automática.
        </p>
      )}
      {missing.length > 0 && (
        <p className="text-sm">
          Sem posição confirmada: {missing.map((c) => `${c.cidade}/${c.uf}`).join(", ")}. Os
          registros continuam na lista.
        </p>
      )}
      {!people.length && <p role="status">Nenhum periódico nos filtros selecionados.</p>}
    </section>
  );
}
