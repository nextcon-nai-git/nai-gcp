"use client";
import { useMemo } from "react";
import { aggregateAvpLocalities } from "@/lib/avp-geo-data";
import { BRAZIL_STATES_PATHS } from "@/lib/brazil-states-paths";
import { periodicCityKey, type PeriodicPerson } from "@/lib/avp-periodic-control";
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
  const groups = useMemo(() => {
    const cities = new Map<string, { city: string; uf: string; counts: Record<string, number> }>();
    for (const person of people) {
      const city = cities.get(person.cityKey) || { city: person.city, uf: person.uf, counts: {} };
      const progress = person.progress || periodicProgress(person.status);
      city.counts[progress] = (city.counts[progress] || 0) + 1;
      cities.set(person.cityKey, city);
    }
    return aggregateAvpLocalities(
      [],
      [...cities.values()].map((c) => ({ cidade: c.city, uf: c.uf }))
    ).map((c) => ({
      ...c,
      cityKey: periodicCityKey(c.cidade, c.uf),
      counts: cities.get(periodicCityKey(c.cidade, c.uf))?.counts || {},
    }));
  }, [people]);
  const unknown = people.filter(
    (p) => (p.progress || periodicProgress(p.status)) === "unknown"
  ).length;
  const missing = groups.filter((g) => !g.geoKnown);
  return (
    <section
      className="rounded-xl border bg-card p-4 space-y-3"
      aria-label="Mapa de periódicos AVP"
    >
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
        viewBox="0 0 800 800"
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
        {groups
          .filter((g) => g.geoKnown)
          .flatMap((city) =>
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
                  transform={`translate(${city.x + (index % 2 ? 11 : -11)},${city.y + (index < 2 ? -11 : 11)})`}
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
