"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { normalizeCnpj } from "@/lib/cnpj";
import type { ServiceAllocationCommand } from "@/lib/financial/service-allocations";
import type {
  ReceiptComponents,
  ServiceBilling,
  ServiceReceiptItem,
  ServiceReceiptsSnapshot,
} from "@/lib/production/service-receipts";

export type ServiceReceiptCommand = ServiceAllocationCommand;
type ServiceMutation = ServiceReceiptCommand extends infer Command
  ? Command extends ServiceReceiptCommand
    ? Omit<
        Command,
        "requestId" | "expectedVersion" | "expectedCentralVersion" | "reviewed" | "reason"
      >
    : never
  : never;
type SaveMutation = (mutation: ServiceMutation, reason: string) => Promise<boolean>;
const field = "min-w-0 w-full rounded-md border border-input bg-background p-2 text-sm";
const money = (cents: number | null) =>
  cents === null
    ? "Sem distribuição"
    : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string) => (value ? value.split("-").reverse().join("/") : "Sem prazo");
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const financialNames = {
  unallocated: "Sem distribuição",
  open: "Saldo em aberto",
  partial: "Recebimento parcial",
  settled: "Quitado e conciliado",
  unreconciled: "Conciliação pendente",
  review: "Revisão necessária",
};
const operationalNames = {
  todo: "A fazer",
  doing: "Em andamento",
  blocked: "Bloqueado",
  done: "Realizado",
  na: "Não aplicável",
};
const documentationNames = {
  pending: "Conferência pendente",
  reviewed: "Revisão e evidência registradas",
  not_applicable: "Não aplicável",
};
const componentLabels: Record<keyof ReceiptComponents, string> = {
  principalCents: "Principal da baixa",
  interestCents: "Juros",
  fineCents: "Multa",
  discountCents: "Desconto",
  withholdingCents: "Retenção",
};
const componentKeys = Object.keys(componentLabels) as (keyof ReceiptComponents)[];
const value = (form: FormData, name: string) => String(form.get(name) || "").trim();
function cents(form: FormData, name: string, positive = false) {
  const raw = value(form, name).replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    throw new Error(
      "Informe valores em reais com até duas casas decimais, sem separador de milhar."
    );
  const parsed = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(parsed) || parsed > 100_000_000_000 || (positive && parsed <= 0))
    throw new Error("Informe um valor válido para a distribuição.");
  return parsed;
}
function searchItem(item: ServiceReceiptItem, query: string) {
  const text = query.trim();
  if (!text) return true;
  return (
    normalize(
      `${item.companyName} ${item.cnpj} ${item.contractName} ${item.cycleName} ${item.title} ${item.serviceType} ${item.owner} ${item.period} ${item.services.map((service) => `${service.supplier} ${service.city}`).join(" ")}`
    ).includes(normalize(text)) ||
    (normalizeCnpj(text).length >= 8 && normalizeCnpj(item.cnpj).includes(normalizeCnpj(text)))
  );
}

function TextField({
  label,
  name,
  required = true,
}: {
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <textarea
        className={field}
        name={name}
        rows={2}
        required={required}
        minLength={required ? 3 : undefined}
        maxLength={1000}
      />
    </label>
  );
}
function AmountField({
  name,
  label,
  defaultValue,
  available,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  available?: number;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      {label} (R$)
      <input
        className={field}
        name={name}
        inputMode="decimal"
        required
        pattern="[0-9]+([.,][0-9]{1,2})?"
        defaultValue={defaultValue}
        placeholder="0,00"
      />
      {available !== undefined && (
        <span className="text-xs text-muted-foreground">Disponível: {money(available)}</span>
      )}
    </label>
  );
}
function ActionForm({
  label,
  disabled,
  children,
  build,
  save,
}: {
  label: string;
  disabled: boolean;
  children?: React.ReactNode;
  build: (form: FormData) => ServiceMutation;
  save: SaveMutation;
}) {
  const [error, setError] = React.useState("");
  return (
    <form
      className="space-y-3"
      aria-label={label}
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled) return;
        setError("");
        try {
          const form = new FormData(event.currentTarget);
          if (form.get("reviewed") !== "on")
            throw new Error("Confirme a conferência antes de salvar.");
          const reason = value(form, "reason");
          if (reason.length < 3) throw new Error("Informe o motivo da alteração.");
          await save(build(form), reason);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Confira os dados informados.");
        }
      }}
    >
      <fieldset className="min-w-0 space-y-3" disabled={disabled}>
        {children}
        <TextField label="Motivo da alteração" name="reason" />
        <label className="flex items-start gap-2 text-sm">
          <input className="mt-1" type="checkbox" name="reviewed" required />
          <span>Conferi o serviço, os valores e a evidência desta alteração.</span>
        </label>
        <Button type="submit" className="max-w-full whitespace-normal">
          {label}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </fieldset>
    </form>
  );
}

function ReceiptForm({
  billing,
  snapshot,
  disabled,
  save,
}: {
  billing: ServiceBilling;
  snapshot: ServiceReceiptsSnapshot;
  disabled: boolean;
  save: SaveMutation;
}) {
  const [settlementId, setSettlementId] = React.useState("");
  const candidates = snapshot.settlements.filter(
    (settlement) =>
      settlement.titleId === billing.titleId &&
      settlement.available.principalCents > 0 &&
      !billing.receipts.some((receipt) => !receipt.voided && receipt.settlementId === settlement.id)
  );
  const settlement = candidates.find((candidate) => candidate.id === settlementId);
  if (!candidates.length || billing.outstandingCents <= 0) return null;
  return (
    <details className="rounded border p-3">
      <summary className="cursor-pointer font-medium">Distribuir uma baixa existente</summary>
      <p className="my-3 text-xs text-muted-foreground">
        Saldo desta distribuição do título: {money(billing.outstandingCents)}. A baixa é escolhida e
        distribuída explicitamente; o extrato continua sendo conferido no ERP.
      </p>
      <ActionForm
        label="Salvar distribuição da baixa"
        disabled={disabled}
        save={save}
        build={(form) => {
          if (!settlement) throw new Error("Selecione uma baixa existente.");
          const amounts = Object.fromEntries(
            componentKeys.map((key) => [key, cents(form, key, key === "principalCents")])
          ) as ReceiptComponents;
          for (const key of componentKeys)
            if (amounts[key] > settlement.available[key])
              throw new Error(`${componentLabels[key]} excede o saldo disponível da baixa.`);
          if (amounts.principalCents > billing.outstandingCents)
            throw new Error("O principal excede o saldo deste serviço no título.");
          if (amounts.discountCents + amounts.withholdingCents > amounts.principalCents)
            throw new Error("Desconto e retenção não podem exceder o principal distribuído.");
          if (
            amounts.principalCents - amounts.discountCents - amounts.withholdingCents >
            settlement.available.principalCents -
              settlement.available.discountCents -
              settlement.available.withholdingCents
          )
            throw new Error(
              "O principal líquido excede o dinheiro ainda disponível na baixa. Confira também a distribuição de descontos e retenções."
            );
          return {
            action: "allocateServiceReceipt",
            id: crypto.randomUUID(),
            billingAllocationId: billing.id,
            settlementId,
            ...amounts,
            evidence: value(form, "evidence"),
          };
        }}
      >
        <label className="grid min-w-0 gap-1 text-sm">
          Baixa do título
          <select
            className={field}
            value={settlementId}
            required
            onChange={(event) => setSettlementId(event.target.value)}
          >
            <option value="">Selecione uma baixa</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {date(candidate.date)} · {candidate.id} · principal disponível{" "}
                {money(candidate.available.principalCents)}
              </option>
            ))}
          </select>
        </label>
        {settlement && (
          <div key={settlement.id} className="space-y-3">
            <p className="text-sm">
              {settlement.reconciled
                ? "Baixa conciliada no ERP"
                : "Baixa com conciliação bancária pendente"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {componentKeys.map((key) => (
                <AmountField
                  key={key}
                  name={key}
                  label={componentLabels[key]}
                  available={settlement.available[key]}
                  defaultValue={key === "principalCents" ? "" : "0"}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Recebido principal = principal menos desconto e retenção. Movimento de caixa
              acrescenta juros e multa.
            </p>
          </div>
        )}
        <TextField label="Evidência da distribuição da baixa" name="evidence" />
      </ActionForm>
    </details>
  );
}

function ItemDetails({
  item,
  snapshot,
  disabled,
  save,
  onOpen,
}: {
  item: ServiceReceiptItem;
  snapshot: ServiceReceiptsSnapshot;
  disabled: boolean;
  save: SaveMutation;
  onOpen: (recordId: string, cycleId: string) => void;
}) {
  const [titleId, setTitleId] = React.useState("");
  const titlesInOtherCycles = new Set(
    [
      ...snapshot.items
        .filter((other) => other.recordId !== item.recordId || other.cycleId !== item.cycleId)
        .flatMap((other) => other.billings),
      ...snapshot.recovery.billings.filter(
        (billing) => billing.recordId !== item.recordId || billing.cycleId !== item.cycleId
      ),
    ]
      .filter((billing) => !billing.voided)
      .map((billing) => billing.titleId)
  );
  const candidates = snapshot.titles.filter(
    (title) =>
      title.contractId === item.financeContractId &&
      title.availableCents > 0 &&
      !titlesInOtherCycles.has(title.id) &&
      !item.billings.some((billing) => !billing.voided && billing.titleId === title.id)
  );
  const title = candidates.find((candidate) => candidate.id === titleId);
  const services = snapshot.services.filter(
    (service) => service.contractId === item.financeContractId && !service.linked
  );
  return (
    <details className="min-w-0 border-t pt-3">
      <summary className="cursor-pointer font-medium">Detalhes, evidências e vínculos</summary>
      <div className="mt-3 min-w-0 space-y-4 text-sm">
        <div className="space-y-1 break-words rounded bg-muted/40 p-3">
          <p>
            <strong>Evidência do serviço:</strong> {item.evidence || "Ainda não registrada"}
          </p>
          <p>
            <strong>Fonte contratual:</strong> {item.sourceReference || "Ainda não registrada"}
          </p>
          <p>
            <strong>Versão contratual:</strong> {item.revision + 1}
          </p>
          <p>
            <strong>Entrega do ciclo:</strong>{" "}
            {item.deliveryEvidence || "Sem evidência de entrega do ciclo"}
          </p>
          <p className="text-xs text-muted-foreground">
            A evidência de entrega acima pertence ao ciclo. A conferência deste serviço considera
            sua própria tarefa, checklist e evidência.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpen(item.recordId, item.cycleId)}
          >
            Abrir ciclo na Central
          </Button>
        </div>
        {item.legacyCycleFinance && (
          <p className="rounded border border-amber-400 p-3">
            O ciclo possui registros financeiros anteriores. Esses valores permanecem sem
            distribuição por serviço até uma associação explícita.
          </p>
        )}
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {(
            [
              ["Principal baixado", item.principalSettledCents],
              ["Retenções e descontos", item.adjustmentCents],
              ["Caixa registrado, com juros e multa", item.cashCents],
              ["Caixa conciliado", item.reconciledCashCents],
              ["Custo declarado vinculado", item.costCents],
            ] as const
          ).map(([label, amount]) => (
            <div className="min-w-0" key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="break-words font-medium">{money(amount)}</dd>
            </div>
          ))}
        </dl>
        {(item.unallocatedReceiptCount > 0 || item.unreconciledCount > 0) && (
          <p>
            {item.unallocatedReceiptCount} baixa(s) com distribuição pendente ·{" "}
            {item.unreconciledCount} baixa(s) sem conciliação válida.
          </p>
        )}
        <section className="min-w-0 space-y-3" aria-label={`Títulos e baixas de ${item.title}`}>
          <h4 className="font-semibold">Títulos e baixas distribuídos</h4>
          {!item.billings.length && (
            <p className="text-muted-foreground">
              Nenhum valor de título foi distribuído para este serviço.
            </p>
          )}
          {item.billings.map((billing) => (
            <article key={billing.id} className="min-w-0 space-y-3 rounded border p-3">
              <div className="break-words">
                <p className="font-medium">
                  {billing.description} · {money(billing.amountCents)}
                </p>
                <p className="text-xs">
                  Título {billing.titleId} · Distribuição {billing.id}
                </p>
                <p className="text-xs">Evidência: {billing.evidence}</p>
                <p>
                  {billing.voided
                    ? "Distribuição anulada — histórico preservado"
                    : `Saldo distribuído: ${money(billing.outstandingCents)}`}
                </p>
              </div>
              {billing.issues.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-amber-800 dark:text-amber-300">
                  {billing.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              )}
              {billing.receipts.map((receipt) => (
                <div key={receipt.id} className="min-w-0 space-y-2 rounded bg-muted/40 p-3">
                  <p className="break-words font-medium">
                    Baixa {receipt.settlementId} · {date(receipt.date)}
                  </p>
                  <p className="text-xs">
                    {receipt.voided
                      ? "Distribuição da baixa anulada"
                      : receipt.reversed
                        ? "Baixa estornada no ERP"
                        : receipt.reconciled
                          ? "Conciliada no ERP"
                          : "Conciliação pendente"}
                  </p>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {componentKeys.map((key) => (
                      <div key={key}>
                        <dt className="text-xs text-muted-foreground">{componentLabels[key]}</dt>
                        <dd>{money(receipt[key])}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="break-words text-xs">Evidência: {receipt.evidence}</p>
                  {!billing.voided && !receipt.voided && (
                    <details>
                      <summary className="cursor-pointer text-xs">
                        Anular distribuição desta baixa
                      </summary>
                      <div className="mt-3">
                        <ActionForm
                          label="Confirmar anulação da distribuição da baixa"
                          disabled={disabled}
                          save={save}
                          build={() => ({ action: "voidServiceReceiptAllocation", id: receipt.id })}
                        />
                      </div>
                    </details>
                  )}
                </div>
              ))}
              {!billing.voided && (
                <>
                  <ReceiptForm
                    key={`${billing.id}:${snapshot.financeVersion}`}
                    billing={billing}
                    snapshot={snapshot}
                    disabled={disabled}
                    save={save}
                  />
                  {billing.receipts.some((receipt) => !receipt.voided && !receipt.reversed) ? (
                    <p className="text-xs text-muted-foreground">
                      Para anular esta distribuição do título, anule primeiro suas distribuições de
                      baixas.
                    </p>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-xs">
                        Anular distribuição deste título
                      </summary>
                      <div className="mt-3">
                        <ActionForm
                          label="Confirmar anulação da distribuição do título"
                          disabled={disabled}
                          save={save}
                          build={() => ({ action: "voidServiceTitleAllocation", id: billing.id })}
                        />
                      </div>
                    </details>
                  )}
                </>
              )}
            </article>
          ))}
        </section>
        <details className="rounded border p-3">
          <summary className="cursor-pointer font-medium">
            Vincular título e distribuir valor
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Distribua cada título entre serviços do mesmo ciclo.
          </p>
          {!candidates.length ? (
            <p className="mt-3 text-muted-foreground">
              Nenhum título aprovado com saldo disponível para distribuição no contrato vinculado.
              Confira o contrato e os títulos no ERP.
            </p>
          ) : (
            <div className="mt-3">
              <ActionForm
                label="Salvar distribuição do título"
                disabled={disabled}
                save={save}
                build={(form) => {
                  if (!title) throw new Error("Selecione um título do contrato.");
                  const amountCents = cents(form, "amountCents", true);
                  if (amountCents > title.availableCents)
                    throw new Error(
                      "O valor excede o saldo disponível para distribuição no título."
                    );
                  return {
                    action: "allocateServiceTitle",
                    id: crypto.randomUUID(),
                    recordId: item.recordId,
                    cycleId: item.cycleId,
                    taskId: item.taskId,
                    sourceFingerprint: item.sourceFingerprint,
                    titleId,
                    amountCents,
                    evidence: value(form, "evidence"),
                  };
                }}
              >
                <label className="grid min-w-0 gap-1 text-sm">
                  Título aprovado do contrato
                  <select
                    className={field}
                    required
                    value={titleId}
                    onChange={(event) => setTitleId(event.target.value)}
                  >
                    <option value="">Selecione um título</option>
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.description} · {candidate.competence} · disponível{" "}
                        {money(candidate.availableCents)}
                      </option>
                    ))}
                  </select>
                </label>
                {title && (
                  <p className="break-words text-xs">
                    {title.party} · Título {title.id} · vencimento {date(title.dueDate)} ·
                    referência fiscal: {title.externalReference || "não registrada"}
                  </p>
                )}
                <AmountField
                  key={titleId}
                  name="amountCents"
                  label="Valor destinado a este serviço"
                  available={title?.availableCents}
                />
                <TextField label="Evidência da distribuição do título" name="evidence" />
              </ActionForm>
            </div>
          )}
        </details>
        <section className="space-y-3" aria-label={`Produção e custo de ${item.title}`}>
          <h4 className="font-semibold">Produção e custo vinculados</h4>
          <p className="text-xs text-muted-foreground">
            O custo declarado é uma referência operacional. O pagamento do prestador é registrado e
            conferido no ERP financeiro.
          </p>
          {!item.services.length && (
            <p className="text-muted-foreground">
              Sem registro de produção vinculado. Custo sem distribuição.
            </p>
          )}
          {item.services.map((service) => (
            <div key={service.id} className="space-y-2 rounded border p-3">
              <p className="break-words">
                {service.description} · {service.quantity} unidade(s) · {date(service.date)}
              </p>
              <p className="text-xs">
                {service.supplier} · {service.city} · custo declarado {money(service.costCents)}
              </p>
              <p className="text-xs">
                {service.billingMode === "included"
                  ? "Incluído na mensalidade; vínculo de custo não distribui a receita da mensalidade."
                  : "Serviço com cobrança avulsa; título e baixa exigem distribuição própria."}
              </p>
              <details>
                <summary className="cursor-pointer text-xs">Retirar vínculo de produção</summary>
                <div className="mt-3">
                  <ActionForm
                    label="Confirmar retirada do vínculo de produção"
                    disabled={disabled}
                    save={save}
                    build={() => ({ action: "unlinkProductionService", serviceId: service.id })}
                  />
                </div>
              </details>
            </div>
          ))}
          <details className="rounded border p-3">
            <summary className="cursor-pointer font-medium">
              Vincular registro de produção e custo
            </summary>
            {!services.length ? (
              <p className="mt-3 text-muted-foreground">
                Nenhum registro de produção disponível para vincular neste contrato.
              </p>
            ) : (
              <div className="mt-3">
                <ActionForm
                  label="Salvar vínculo de produção"
                  disabled={disabled}
                  save={save}
                  build={(form) => ({
                    action: "linkProductionService",
                    serviceId: value(form, "serviceId"),
                    recordId: item.recordId,
                    cycleId: item.cycleId,
                    taskId: item.taskId,
                    sourceFingerprint: item.sourceFingerprint,
                    evidence: value(form, "evidence"),
                  })}
                >
                  <label className="grid min-w-0 gap-1 text-sm">
                    Registro de produção do contrato
                    <select className={field} name="serviceId" required defaultValue="">
                      <option value="">Selecione um registro</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.description} · {service.quantity} unidade(s) ·{" "}
                          {date(service.date)} · {service.supplier} · custo{" "}
                          {money(service.costCents)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TextField label="Evidência do vínculo de produção" name="evidence" />
                </ActionForm>
              </div>
            )}
          </details>
        </section>
      </div>
    </details>
  );
}

function AssociationOrigin({
  origin,
}: {
  origin: Pick<
    ServiceReceiptItem,
    "recordId" | "cycleId" | "taskId" | "companyName" | "contractName" | "cycleName" | "period"
  >;
}) {
  return (
    <div className="min-w-0 space-y-1 break-words text-xs text-muted-foreground">
      <p>
        {origin.companyName || "Cliente de origem indisponível"} ·{" "}
        {origin.contractName || "Contrato de origem indisponível"}
      </p>
      <p>
        Ciclo de origem: {origin.cycleName || "não disponível"}
        {origin.period ? ` · ${origin.period}` : ""}
      </p>
      <p>
        Referências: registro {origin.recordId} · ciclo {origin.cycleId} · tarefa {origin.taskId}
      </p>
    </div>
  );
}

function RecoveryAssociations({
  recovery,
  disabled,
  save,
}: {
  recovery: ServiceReceiptsSnapshot["recovery"];
  disabled: boolean;
  save: SaveMutation;
}) {
  if (!recovery.billings.length && !recovery.services.length) return null;
  return (
    <section
      aria-label="Associações que precisam de correção"
      className="min-w-0 space-y-4 rounded-lg border border-amber-400 p-3 sm:p-4"
    >
      <div className="space-y-1">
        <h3 className="font-semibold">Associações que precisam de correção</h3>
        <p className="text-sm text-muted-foreground">
          Estas associações não estão vinculadas a uma linha disponível na consulta atual. Confira
          as referências antes de corrigir. Elas ficam separadas da lista de serviços e dos seus
          totais.
        </p>
      </div>
      {recovery.billings.map((billing) => (
        <article
          key={billing.id}
          className="min-w-0 space-y-3 rounded border bg-background p-3"
          aria-label={`Corrigir distribuição ${billing.id}`}
        >
          <div className="min-w-0 space-y-1 break-words">
            <h4 className="font-medium">
              {billing.description || "Distribuição de título sem origem disponível"}
            </h4>
            <p className="text-sm">
              Título {billing.titleId} · distribuição {billing.id} · valor registrado{" "}
              {money(billing.amountCents)}
            </p>
            <AssociationOrigin origin={billing} />
            <p className="text-xs">Evidência da associação: {billing.evidence}</p>
          </div>
          {billing.issues.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {billing.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          )}
          {billing.receipts.map((receipt) => (
            <div key={receipt.id} className="min-w-0 space-y-2 rounded bg-muted/50 p-3">
              <p className="break-words text-sm">
                Baixa {receipt.settlementId} · distribuição {receipt.id} · {date(receipt.date)}
              </p>
              <p className="text-xs">
                {receipt.voided
                  ? "Distribuição da baixa anulada — histórico preservado"
                  : receipt.reversed
                    ? "Baixa estornada no ERP; associação preservada"
                    : receipt.reconciled
                      ? "Baixa conciliada no ERP"
                      : "Conciliação da baixa pendente"}
              </p>
              <p className="text-xs">
                Principal registrado: {money(receipt.principalCents)} · descontos e retenções:{" "}
                {money(receipt.discountCents + receipt.withholdingCents)}
              </p>
              <p className="break-words text-xs">Evidência: {receipt.evidence}</p>
              {!billing.voided && !receipt.voided && (
                <details>
                  <summary className="cursor-pointer text-sm">
                    Corrigir distribuição desta baixa
                  </summary>
                  <div className="mt-3">
                    <ActionForm
                      label="Anular distribuição da baixa"
                      disabled={disabled}
                      save={save}
                      build={() => ({ action: "voidServiceReceiptAllocation", id: receipt.id })}
                    />
                  </div>
                </details>
              )}
            </div>
          ))}
          {billing.voided ? (
            <p className="text-sm">Distribuição do título anulada — histórico preservado.</p>
          ) : billing.receipts.some((receipt) => !receipt.voided) ? (
            <p className="text-sm">
              Anule primeiro as distribuições das baixas acima para corrigir a associação do título.
            </p>
          ) : (
            <details>
              <summary className="cursor-pointer text-sm">
                Corrigir distribuição deste título
              </summary>
              <div className="mt-3">
                <ActionForm
                  label="Anular distribuição do título"
                  disabled={disabled}
                  save={save}
                  build={() => ({ action: "voidServiceTitleAllocation", id: billing.id })}
                />
              </div>
            </details>
          )}
        </article>
      ))}
      {recovery.services.map((service) => (
        <article
          key={service.serviceId}
          className="min-w-0 space-y-3 rounded border bg-background p-3"
          aria-label={`Corrigir vínculo ${service.serviceId}`}
        >
          <div className="min-w-0 space-y-1 break-words">
            <h4 className="font-medium">
              {service.description || "Vínculo de produção sem origem disponível"}
            </h4>
            <p className="text-sm">Registro de produção: {service.serviceId}</p>
            <AssociationOrigin origin={service} />
            <p className="text-xs">Evidência do vínculo: {service.evidence}</p>
          </div>
          {service.issues.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {service.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-sm">Corrigir vínculo de produção</summary>
            <div className="mt-3">
              <ActionForm
                label="Retirar vínculo de produção"
                disabled={disabled}
                save={save}
                build={() => ({ action: "unlinkProductionService", serviceId: service.serviceId })}
              />
            </div>
          </details>
        </article>
      ))}
    </section>
  );
}

export function ServiceReceipts({
  centralVersion,
  loadSnapshot,
  saveCommand,
  onOpen,
}: {
  centralVersion: number;
  loadSnapshot: (signal: AbortSignal, expectedVersion: number) => Promise<ServiceReceiptsSnapshot>;
  saveCommand: (signal: AbortSignal, command: ServiceReceiptCommand) => Promise<unknown>;
  onOpen: (recordId: string, cycleId: string) => void;
}) {
  const [snapshot, setSnapshot] = React.useState<ServiceReceiptsSnapshot | null>(null);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [reading, setReading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [refresh, setRefresh] = React.useState(0);
  const [pending, setPending] = React.useState<ServiceReceiptCommand | null>(null);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<keyof typeof financialNames | "all">("all");
  const [limit, setLimit] = React.useState(20);
  const scope = React.useRef(new AbortController());
  const request = React.useRef<AbortController | null>(null);
  const lock = React.useRef(false);
  React.useEffect(() => {
    if (scope.current.signal.aborted) scope.current = new AbortController();
    const controller = scope.current;
    return () => controller.abort();
  }, []);
  React.useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const signal = AbortSignal.any([controller.signal, scope.current.signal]);
    setSnapshot(null);
    setError("");
    setReading(true);
    setLimit(20);
    void (async () => {
      try {
        const result = await loadSnapshot(signal, centralVersion);
        if (signal.aborted) return;
        if (result.centralVersion !== centralVersion)
          throw new Error("A Central mudou. Atualize a Central e consulte os serviços novamente.");
        setSnapshot(result);
      } catch (cause) {
        if (!signal.aborted) {
          setSnapshot(null);
          setError(
            cause instanceof Error ? cause.message : "Não foi possível consultar os serviços."
          );
        }
      } finally {
        if (!signal.aborted) setReading(false);
      }
    })();
    return () => controller.abort();
  }, [centralVersion, loadSnapshot, refresh]);
  const current = snapshot?.centralVersion === centralVersion ? snapshot : null;
  const disabled = reading || saving || !!pending;
  const runCommand = async (command: ServiceReceiptCommand) => {
    if (lock.current || scope.current.signal.aborted) return false;
    lock.current = true;
    const signal = scope.current.signal;
    request.current?.abort();
    setReading(false);
    setSaving(true);
    setPending(command);
    setSnapshot(null);
    setError("");
    setNotice("");
    try {
      await saveCommand(signal, command);
      if (signal.aborted) return false;
      setPending(null);
      setNotice("Alteração salva e confirmada. Atualizando a distribuição dos serviços.");
      setRefresh((count) => count + 1);
      return true;
    } catch (cause) {
      if (signal.aborted) return false;
      const status =
        typeof cause === "object" && cause !== null && "status" in cause ? Number(cause.status) : 0;
      const definitive = status >= 400 && status < 500 && status !== 408;
      if (definitive) setPending(null);
      setError(
        `${cause instanceof Error ? cause.message : "Não foi possível confirmar a alteração."} ${definitive ? "Atualize a consulta e confira os dados antes de tentar novamente." : "A solicitação foi preservada. Repita a mesma solicitação para conferir o resultado com segurança."}`
      );
      return false;
    } finally {
      lock.current = false;
      if (!signal.aborted) setSaving(false);
    }
  };
  const save: SaveMutation = async (mutation, reason) => {
    if (!current || disabled || lock.current) return false;
    return runCommand({
      ...mutation,
      requestId: crypto.randomUUID(),
      expectedVersion: current.financeVersion,
      expectedCentralVersion: current.centralVersion,
      reviewed: true,
      reason,
    });
  };
  const filtered = (current?.items || []).filter(
    (item) => (status === "all" || item.financialStatus === status) && searchItem(item, search)
  );
  return (
    <section
      className="min-w-0 space-y-4 rounded-lg border p-4"
      aria-label="Serviços e recebimentos"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl space-y-1">
          <h2 className="text-lg font-semibold">Serviços e recebimentos</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe cada obrigação do contrato, sua conferência documental e os valores
            distribuídos de títulos e baixas.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={reading || saving}
          onClick={() => {
            setSnapshot(null);
            setRefresh((count) => count + 1);
          }}
        >
          Atualizar serviços
        </Button>
      </header>
      {error && (
        <p role="alert" className="rounded border border-destructive p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {saving && (
        <p role="status" className="text-sm">
          Salvando distribuição…
        </p>
      )}
      {pending && !saving && (
        <Button
          type="button"
          variant="outline"
          disabled={reading}
          onClick={() => runCommand(pending)}
        >
          Repetir solicitação preservada
        </Button>
      )}
      {!current && !error && !saving && (
        <p role="status" className="text-sm">
          Consultando serviços na Central e no ERP…
        </p>
      )}
      {current && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              ["Serviços sem distribuição", current.summary.unallocatedCount],
              ["Valor de títulos distribuído", money(current.summary.billedCents)],
              ["Recebido principal registrado", money(current.summary.receivedCents)],
              ["Saldo sem baixa distribuída", money(current.summary.outstandingCents)],
            ].map(([label, amount]) => (
              <div key={label} className="min-w-0 rounded-md bg-muted p-3">
                <p className="text-xs">{label}</p>
                <strong className="break-words text-lg">{amount}</strong>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Os indicadores somam distribuições válidas identificadas. Valores desconhecidos
              aparecem como “Sem distribuição”. Retenções e descontos ficam separados do recebido
              principal.
            </p>
            <p>
              Baixas registradas podem estar sem conciliação. Confira “Caixa conciliado” nos
              detalhes. O saldo pode incluir recebimentos do título ainda sem distribuição por
              serviço; confira antes de cobrar.
            </p>
            <p>
              {current.summary.reviewCount} serviço(s) para revisar ·{" "}
              {current.summary.withoutTasksCount} ciclo(s) sem tarefas individualizadas · custo
              declarado vinculado: {money(current.summary.costCents)}.
            </p>
            <p>
              Consulta de{" "}
              {new Date(current.generatedAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}{" "}
              (Brasília) · Central v{current.centralVersion} · ERP v{current.financeVersion}
            </p>
          </div>
          {current.issues.length > 0 && (
            <div className="rounded border border-amber-400 p-3 text-sm">
              <h3 className="font-medium">Pontos para conferir</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {current.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <RecoveryAssociations recovery={current.recovery} disabled={disabled} save={save} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid min-w-0 gap-1 text-sm">
              Buscar serviços
              <input
                className={field}
                value={search}
                placeholder="Cliente, CNPJ, contrato, serviço ou responsável"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setLimit(20);
                }}
              />
            </label>
            <label className="grid min-w-0 gap-1 text-sm">
              Filtrar situação financeira
              <select
                className={field}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as typeof status);
                  setLimit(20);
                }}
              >
                <option value="all">Todas as situações</option>
                {Object.entries(financialNames).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p role="status" className="text-sm">
            {filtered.length} serviço(s) no filtro · exibindo {Math.min(limit, filtered.length)}
          </p>
          {!current.items.length ? (
            <p className="text-sm">
              Nenhuma obrigação individualizada encontrada nesta consulta. Abra o contrato na
              Central para conferir suas tarefas.
            </p>
          ) : !filtered.length ? (
            <p className="text-sm">Nenhum serviço corresponde a este filtro.</p>
          ) : (
            <div className="space-y-4">
              {filtered.slice(0, limit).map((item) => (
                <article
                  key={`${item.key}:${current.financeVersion}`}
                  className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4"
                  aria-label={`Serviço ${item.title} de ${item.companyName}`}
                >
                  <header className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 break-words">
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm">
                        {item.companyName} · {item.cnpj}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.contractName} · {item.cycleName} · {item.period}
                      </p>
                    </div>
                    <p className="text-xs">
                      {item.owner || "Responsável pendente"} · {date(item.due)}
                    </p>
                  </header>
                  <dl className="grid gap-2 sm:grid-cols-3">
                    {[
                      ["Execução", operationalNames[item.operationalStatus]],
                      ["Documentação", documentationNames[item.documentationStatus]],
                      ["Financeiro", financialNames[item.financialStatus]],
                    ].map(([label, text]) => (
                      <div key={label} className="rounded bg-muted/50 p-2">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="text-sm font-medium">{text}</dd>
                      </div>
                    ))}
                  </dl>
                  <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {(
                      [
                        ["Título distribuído", item.billedCents],
                        ["Recebido principal registrado", item.receivedCents],
                        ["Retenções/descontos", item.adjustmentCents],
                        ["Saldo sem baixa distribuída", item.outstandingCents],
                      ] as const
                    ).map(([label, amount]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="break-words font-semibold">{money(amount)}</dd>
                      </div>
                    ))}
                  </dl>
                  {item.issues.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
                      {item.issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  <ItemDetails
                    item={item}
                    snapshot={current}
                    disabled={disabled}
                    save={save}
                    onOpen={onOpen}
                  />
                </article>
              ))}
            </div>
          )}
          {limit < filtered.length && (
            <Button type="button" variant="outline" onClick={() => setLimit((count) => count + 20)}>
              Mostrar mais 20
            </Button>
          )}
        </>
      )}
      <Button asChild variant="outline">
        <Link href="/financial/operacoes">Conferir títulos e extrato no ERP</Link>
      </Button>
    </section>
  );
}
