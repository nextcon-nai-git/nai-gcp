"use client";
import { useState } from "react";
import { operatingProcedure, type ProcedureBlock } from "@/lib/production/operating-procedure";
import { Input } from "@/components/ui/input";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
function Block({ block }: { block: ProcedureBlock }) {
  if (block.kind === "heading") return <h4 className="text-base font-semibold">{block.text}</h4>;
  if (block.kind === "paragraph") return <p className="whitespace-pre-line">{block.text}</p>;
  if (block.kind === "steps")
    return (
      <ol className="list-decimal space-y-3 pl-6">
        {block.items.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    );
  if (block.kind === "table")
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {block.headers.map((header) => (
                <th scope="col" key={header} className="border p-3 bg-muted">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, column) => (
                  <td key={column} className="border p-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
}
export function OperatingProcedure() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["visao-geral"]));
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const visible = operatingProcedure.sections.filter((section) => {
    const text = normalize(JSON.stringify(section));
    return terms.every((term) => text.includes(term));
  });
  return (
    <section className="space-y-5" aria-label="Procedimento completo do contrato ao recebimento">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">Procedimento completo do contrato ao recebimento</h2>
        <p className="text-sm text-muted-foreground">
          POP 01 · versão {operatingProcedure.version} · atualizado em{" "}
          {operatingProcedure.updatedOn}
        </p>
        <p>
          Consulte o passo a passo, os responsáveis e os critérios para avançar. A leitura deste
          guia não altera cards, não emite notas e não envia mensagens.
        </p>
      </header>
      <Input
        aria-label="Buscar no procedimento"
        placeholder="Busque por contrato, ASO, nota fiscal, recebimento…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <nav aria-label="Etapas do procedimento" className="flex flex-wrap gap-2">
        {visible.map((section) => (
          <a
            key={section.id}
            href={`#pop-${section.id}`}
            className="rounded border px-3 py-2 text-sm underline underline-offset-4"
            onClick={() => setExpanded((old) => new Set([...old, section.id]))}
          >
            {section.title}
          </a>
        ))}
      </nav>
      <p role="status" className="text-sm">
        {visible.length} de {operatingProcedure.sections.length} seções
        {terms.length ? " encontradas" : " disponíveis"}.
      </p>
      {!visible.length && <p>Nenhuma seção encontrada. Tente outro termo ou limpe a busca.</p>}
      {visible.map((section) => (
        <details
          key={section.id}
          id={`pop-${section.id}`}
          open={terms.length > 0 || expanded.has(section.id)}
          className="scroll-mt-24 rounded-lg border p-4"
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setExpanded((old) => {
              if (old.has(section.id) === open) return old;
              const next = new Set(old);
              if (open) next.add(section.id);
              else next.delete(section.id);
              return next;
            });
          }}
        >
          <summary className="cursor-pointer text-lg font-semibold">{section.title}</summary>
          <div className="mt-4 space-y-4 text-sm leading-relaxed">
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}
