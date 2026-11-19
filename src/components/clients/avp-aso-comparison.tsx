"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeCnpj } from "@/lib/cnpj";
import type { AvpAsoEvidence } from "@/lib/avp-evidence";

export type ComparableAso = AvpAsoEvidence & { uploaded?: boolean };

const searchable = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

function citedCnpjs(record: ComparableAso) {
  const text = [
    record.companyCnpj && `CNPJ ${record.companyCnpj}`,
    record.company,
    record.notes,
  ].join(" ");
  const matches = text.matchAll(
    /\b(?:([a-z0-9]{2}\.[a-z0-9]{3}\.[a-z0-9]{3}\/[a-z0-9]{4}-\d{2})|cnpj\s*[:#-]?\s*([a-z0-9]{12}\d{2})|(\d{14}))\b/gi
  );
  const numbers = new Set(Array.from(matches, (m) => normalizeCnpj(m[1] ?? m[2] ?? m[3])));
  return [...numbers]
    .sort()
    .map((n) => n.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5"))
    .join(", ");
}

const fields = [
  ["Colaborador", "employee"],
  ["Empregador informado", "company"],
  ["CNPJs citados no cadastro ou nas observações", "citedCnpjs"],
  ["CNPJ do empregador no ASO", "companyCnpj"],
  ["Código do colaborador no SOC", "socEmployeeCode"],
  ["Tipo de exame", "examType"],
  ["Data do exame", "examDate"],
  ["Cidade", "city"],
  ["UF", "uf"],
  ["Recebimento", "receivedDate"],
  ["Situação", "review"],
  ["Fonte", "source"],
  ["Observações da conferência", "notes"],
  ["Arquivo", "fileName"],
] as const;

export function AvpAsoComparison({
  first,
  choices,
  onClose,
  onOpenPdf,
}: {
  first: ComparableAso;
  choices: ComparableAso[];
  onClose: () => void;
  onOpenPdf: (id: string, fileName: string) => void;
}) {
  const [search, setSearch] = React.useState(first.employee);
  const [selectedId, setSelectedId] = React.useState("");
  const term = searchable(search);
  const candidates = choices.filter(
    (r) =>
      r.id !== first.id &&
      searchable([r.employee, r.company, r.fileName, r.source].join(" ")).includes(term)
  );
  const second = candidates.find((r) => r.id === selectedId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Comparar vias do ASO</DialogTitle>
          <DialogDescription>
            Confira o CNPJ no documento e no pedido de retificação da unidade. A seleção serve
            apenas para consulta.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          <strong>Primeira via</strong> · {first.employee} · {first.company} · {first.fileName}
        </p>
        <label className="grid gap-1 text-sm">
          Buscar outra via no acervo ou no lote
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedId("");
            }}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Segunda via
          <select
            className="w-full rounded border p-2"
            value={second?.id || ""}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Selecione uma evidência</option>
            {candidates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.employee} · {r.company} · {r.examDate || "Data a conferir"} · {r.fileName} ·{" "}
                {r.source}
              </option>
            ))}
          </select>
        </label>
        {!candidates.length && (
          <p className="text-sm">
            Nenhuma outra via corresponde à busca. Você pode pesquisar outro nome, empresa ou
            arquivo.
          </p>
        )}
        {second && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <caption className="sr-only">Dados das duas vias selecionadas</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-1/4 p-2">
                      Campo
                    </th>
                    <th scope="col" className="p-2">
                      Primeira via
                    </th>
                    <th scope="col" className="p-2">
                      Segunda via
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(([label, field]) => {
                    const values = [first, second].map((r) =>
                      field === "citedCnpjs" ? citedCnpjs(r) : r[field]
                    );
                    const different = searchable(values[0]) !== searchable(values[1]);
                    return (
                      <tr key={field} className={different ? "border-t bg-amber-50" : "border-t"}>
                        <th scope="row" className="p-2 align-top">
                          {label}
                          {different && <small className="block text-amber-800">Divergência</small>}
                        </th>
                        {values.map((value, index) => (
                          <td key={index} className="break-words p-2 align-top">
                            {value ||
                              (field === "citedCnpjs"
                                ? "Conferir no PDF e no pedido de retificação"
                                : "Sem informação")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr className="border-t">
                    <th scope="row" className="p-2">
                      PDF
                    </th>
                    {[first, second].map((r) => (
                      <td key={r.id} className="p-2">
                        {r.uploaded ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenPdf(r.id, r.fileName)}
                          >
                            Abrir PDF
                          </Button>
                        ) : (
                          "Pendente de anexo"
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {first.fileHash && first.fileHash === second.fileHash && (
              <p className="text-sm font-semibold">
                Os índices informam o mesmo conteúdo de PDF (SHA-256 idêntico).
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
