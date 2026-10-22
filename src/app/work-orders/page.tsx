"use client";
import * as React from "react";
import { Download, Printer, Share2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  getDefaultWorkOrderData,
  downloadWorkOrderPdf,
  getWhatsAppOsDispatchMessage,
  validateWorkOrder,
  workOrderAcknowledgement,
} from "@/services/documents/work-order-pdf-generator";
import type { WorkOrderData, WorkOrderRiskItem, WorkOrderPpeItem } from "@/types/work-order";

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block space-y-1 text-sm">
      <span>{label}</span>
      <Input id={id} value={value} maxLength={240} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Lines({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label htmlFor={id} className="block space-y-1 text-sm">
      <span>{label} — um item por linha</span>
      <Textarea
        id={id}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
      />
    </label>
  );
}
const companyLabels: Record<keyof WorkOrderData["empresa"], string> = {
  razaoSocial: "Razão social",
  nomeFantasia: "Nome fantasia",
  cnpj: "CNPJ",
  cnae: "CNAE",
  grauRisco: "Grau de risco",
  endereco: "Endereço",
  cidadeUf: "Cidade / UF",
  contratante: "Contratante (se aplicável)",
  unidadeOperacional: "Unidade / local de trabalho",
};
const employeeLabels: Record<keyof WorkOrderData["colaborador"], string> = {
  nome: "Nome completo",
  cpf: "CPF",
  matricula: "Matrícula",
  cargo: "Cargo / função",
  setor: "Setor",
  ghe: "GHE / GES",
  dataAdmissao: "Data de admissão",
  dataEmissaoOs: "Data de emissão da minuta",
};
const riskLabels = {
  fatorRisco: "Fator de risco",
  fontes: "Fontes / circunstâncias",
  possiveisDanos: "Possíveis danos",
  severidade: "Severidade",
  probabilidade: "Probabilidade",
  nivelRisco: "Nível de risco",
} as const;
const ppeLabels: Record<keyof WorkOrderPpeItem, string> = {
  equipamento: "Equipamento",
  ca: "CA",
  obrigatoriedade: "Condição de uso",
  finalidade: "Finalidade",
};
const missing = (v: string) => v.trim() || "Não informado";
function PreviewList({ values, empty }: { values: string[]; empty: string }) {
  const entries = values.filter((v) => v.trim());
  return entries.length ? (
    <ul className="list-disc pl-5 space-y-1">
      {entries.map((v, i) => (
        <li key={i}>{v}</li>
      ))}
    </ul>
  ) : (
    <p className="text-amber-700 dark:text-amber-300">{empty}</p>
  );
}
export default function WorkOrdersPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<WorkOrderData>(getDefaultWorkOrderData);
  const [phone, setPhone] = React.useState("55");
  const [busy, setBusy] = React.useState(false);
  const change = <K extends keyof WorkOrderData>(key: K, value: WorkOrderData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));
  function validated(action: () => void) {
    const error = validateWorkOrder(data);
    if (error) {
      toast({ variant: "destructive", title: "Confira os dados da minuta", description: error });
      return;
    }
    try {
      action();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Operação não concluída",
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  }
  function download() {
    validated(() => {
      setBusy(true);
      try {
        downloadWorkOrderPdf(data);
        toast({
          title: "Minuta PDF gerada",
          description: "Confira o documento e obtenha revisão técnica e assinaturas antes do uso.",
        });
      } finally {
        setBusy(false);
      }
    });
  }
  function share() {
    validated(() => {
      const recipient = phone.replace(/\D/g, "");
      const message = getWhatsAppOsDispatchMessage(data);
      window.open(
        `https://wa.me/${recipient.length > 5 ? recipient : ""}?text=${message}`,
        "_blank",
        "noopener,noreferrer"
      );
      toast({
        title: "Conversa preparada",
        description:
          "Confira a mensagem e anexe o PDF no WhatsApp. O sistema não confirmou entrega.",
      });
    });
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="space-y-3 print:hidden">
        <h1 className="text-2xl font-bold">Ordens de Serviço de SST — NR-01</h1>
        <p className="text-muted-foreground">
          Prepare a minuta para qualquer cliente, conforme a função, as atividades e o PGR vigente
          da empresa.
        </p>
        <p className="rounded-xl border border-amber-500 p-3 text-sm">
          Minuta para revisão técnica e assinaturas. Preencha os dados do cliente e as informações
          do PGR; nenhum risco, EPI ou procedimento é presumido. Os dados deste formulário são
          usados apenas no documento e não alteram cadastros.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download} disabled={busy}>
            <Download className="mr-2 size-4" />
            {busy ? "Gerando PDF…" : "Baixar minuta PDF"}
          </Button>
          <Button variant="outline" onClick={() => validated(() => window.print())}>
            <Printer className="mr-2 size-4" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={share}>
            <Share2 className="mr-2 size-4" />
            Preparar WhatsApp
          </Button>
        </div>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-5 print:hidden">
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-bold">Empresa / cliente</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(companyLabels).map(([key, label]) => (
                <Field
                  key={key}
                  id={`empresa-${key}`}
                  label={label}
                  value={data.empresa[key as keyof typeof data.empresa]}
                  onChange={(v) =>
                    setData((prev) => ({ ...prev, empresa: { ...prev.empresa, [key]: v } }))
                  }
                />
              ))}
            </div>
          </section>
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-bold">Colaborador</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(employeeLabels).map(([key, label]) => (
                <Field
                  key={key}
                  id={key}
                  label={label}
                  value={data.colaborador[key as keyof typeof data.colaborador]}
                  onChange={(v) =>
                    setData((prev) => ({ ...prev, colaborador: { ...prev.colaborador, [key]: v } }))
                  }
                />
              ))}
            </div>
          </section>
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-bold">Referência técnica e atividades</h2>
            <Field
              id="controle"
              label="Número de controle"
              value={data.numeroControle}
              onChange={(v) => change("numeroControle", v)}
            />
            <Field
              id="pgr"
              label="PGR / revisão de referência"
              value={data.versaoPgr}
              onChange={(v) => change("versaoPgr", v)}
            />
            <Field
              id="vigencia"
              label="Vigência do PGR"
              value={data.vigenciaPgr}
              onChange={(v) => change("vigenciaPgr", v)}
            />
            <Lines
              id="atividades"
              label="Atividades da função"
              value={data.descricaoAtividades}
              onChange={(v) => change("descricaoAtividades", v)}
            />
          </section>
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-bold">Riscos conforme o PGR</h2>
            <p className="text-sm text-muted-foreground">
              Lista vazia significa preenchimento pendente, e não ausência de riscos.
            </p>
            {data.riscosIdentificados.map((risk, index) => (
              <div key={index} className="space-y-3 rounded border p-3">
                <label className="block text-sm">
                  Grupo de risco
                  <select
                    aria-label={`Grupo do risco ${index + 1}`}
                    className="mt-1 block w-full rounded border bg-background p-2"
                    value={risk.grupo}
                    onChange={(e) =>
                      change(
                        "riscosIdentificados",
                        data.riscosIdentificados.map((item, i) =>
                          i === index
                            ? { ...item, grupo: e.target.value as WorkOrderRiskItem["grupo"] }
                            : item
                        )
                      )
                    }
                  >
                    {["Acidente", "Físico", "Químico", "Biológico", "Ergonômico"].map((group) => (
                      <option key={group}>{group}</option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(riskLabels).map(([key, label]) => (
                    <Field
                      key={key}
                      id={`risco-${index}-${key}`}
                      label={label}
                      value={risk[key as keyof typeof riskLabels]}
                      onChange={(v) =>
                        change(
                          "riscosIdentificados",
                          data.riscosIdentificados.map((item, i) =>
                            i === index ? { ...item, [key]: v } : item
                          )
                        )
                      }
                    />
                  ))}
                </div>
                <label className="block space-y-1 text-sm" htmlFor={`medidas-${index}`}>
                  Medidas preventivas
                  <Textarea
                    id={`medidas-${index}`}
                    value={risk.medidasPrevenconais}
                    onChange={(e) =>
                      change(
                        "riscosIdentificados",
                        data.riscosIdentificados.map((item, i) =>
                          i === index ? { ...item, medidasPrevenconais: e.target.value } : item
                        )
                      )
                    }
                  />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    change(
                      "riscosIdentificados",
                      data.riscosIdentificados.filter((_, i) => i !== index)
                    )
                  }
                >
                  <Trash2 className="mr-1 size-4" />
                  Remover risco {index + 1}
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                change("riscosIdentificados", [
                  ...data.riscosIdentificados,
                  {
                    fatorRisco: "",
                    grupo: "Acidente",
                    fontes: "",
                    possiveisDanos: "",
                    severidade: "",
                    probabilidade: "",
                    nivelRisco: "",
                    medidasPrevenconais: "",
                  },
                ])
              }
            >
              <Plus className="mr-1 size-4" />
              Adicionar risco
            </Button>
          </section>
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-bold">EPIs definidos para a função</h2>
            {data.episObrigatorios.map((ppe, index) => (
              <div key={index} className="space-y-3 rounded border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(ppeLabels).map(([key, label]) => (
                    <Field
                      key={key}
                      id={`epi-${index}-${key}`}
                      label={label}
                      value={ppe[key as keyof WorkOrderPpeItem]}
                      onChange={(v) =>
                        change(
                          "episObrigatorios",
                          data.episObrigatorios.map((item, i) =>
                            i === index ? { ...item, [key]: v } : item
                          )
                        )
                      }
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    change(
                      "episObrigatorios",
                      data.episObrigatorios.filter((_, i) => i !== index)
                    )
                  }
                >
                  Remover EPI {index + 1}
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                change("episObrigatorios", [
                  ...data.episObrigatorios,
                  { equipamento: "", ca: "", obrigatoriedade: "", finalidade: "" },
                ])
              }
            >
              <Plus className="mr-1 size-4" />
              Adicionar EPI
            </Button>
          </section>
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-bold">Instruções e emergências</h2>
            <Lines
              id="instrucoes"
              label="Instruções de segurança"
              value={data.regrasSeguranca.map((r) => r.descricao)}
              onChange={(v) =>
                change(
                  "regrasSeguranca",
                  v.map((descricao) => ({ titulo: "", descricao }))
                )
              }
            />
            <Lines
              id="proibicoes"
              label="Proibições aplicáveis"
              value={data.proibicoesExpressas}
              onChange={(v) => change("proibicoesExpressas", v)}
            />
            <Lines
              id="emergencia"
              label="Procedimentos e contatos de emergência"
              value={data.procedimentosEmergencia}
              onChange={(v) => change("procedimentosEmergencia", v)}
            />
            <label htmlFor="orientacoes" className="block text-sm">
              Orientações gerais
              <Textarea
                id="orientacoes"
                value={data.orientacoesGerais}
                onChange={(e) => change("orientacoesGerais", e.target.value)}
              />
            </label>
          </section>
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-bold">Responsável por SST</h2>
            {Object.entries({
              nome: "Nome do responsável",
              cargo: "Cargo do responsável",
              registroProfissional: "Registro profissional",
            }).map(([key, label]) => (
              <Field
                key={key}
                id={`responsavel-${key}`}
                label={label}
                value={data.responsavelSst[key as keyof typeof data.responsavelSst]}
                onChange={(v) =>
                  setData((prev) => ({
                    ...prev,
                    responsavelSst: { ...prev.responsavelSst, [key]: v },
                  }))
                }
              />
            ))}
          </section>
          <Field
            id="phone"
            label="WhatsApp do destinatário (com DDI e DDD)"
            value={phone}
            onChange={setPhone}
          />
          <Button
            variant="outline"
            onClick={() => {
              setData(getDefaultWorkOrderData());
              setPhone("55");
              toast({ title: "Nova minuta em branco" });
            }}
          >
            Nova ordem de serviço
          </Button>
        </div>
        <article
          id="work-order-preview"
          className="space-y-5 break-words rounded-xl border bg-card p-5 text-sm print:border-0 print:p-0"
        >
          <h2 className="text-xl font-bold">ORDEM DE SERVIÇO DE SST — NR-01</h2>
          <p className="font-semibold text-amber-700 dark:text-amber-300">
            MINUTA — REQUER REVISÃO TÉCNICA E ASSINATURAS
          </p>
          <p>
            Controle: {missing(data.numeroControle)} | Emissão: {data.colaborador.dataEmissaoOs}
          </p>
          <section>
            <h3 className="font-bold">1. Empregador e local de trabalho</h3>
            {Object.entries(companyLabels).map(([key, label]) => (
              <p key={key}>
                <strong>{label}:</strong> {missing(data.empresa[key as keyof typeof data.empresa])}
              </p>
            ))}
          </section>
          <section>
            <h3 className="font-bold">2. Colaborador e referência técnica</h3>
            {Object.entries(employeeLabels).map(([key, label]) => (
              <p key={key}>
                <strong>{label}:</strong>{" "}
                {missing(data.colaborador[key as keyof typeof data.colaborador])}
              </p>
            ))}
            <p>PGR / revisão: {missing(data.versaoPgr)}</p>
            <p>Vigência: {missing(data.vigenciaPgr)}</p>
          </section>
          <section>
            <h3 className="font-bold">3. Atividades da função</h3>
            <PreviewList values={data.descricaoAtividades} empty="Atividades não informadas." />
          </section>
          <section>
            <h3 className="font-bold">4. Riscos e medidas de prevenção</h3>
            {!data.riscosIdentificados.length && (
              <p>Riscos não informados. Conferir o PGR; isto não significa ausência de riscos.</p>
            )}
            {data.riscosIdentificados.map((r, i) => (
              <div key={i} className="my-2 border-l-2 pl-3">
                <p className="font-semibold">
                  {r.grupo}: {missing(r.fatorRisco)}
                </p>
                <p>Fontes: {missing(r.fontes)}</p>
                <p>Danos: {missing(r.possiveisDanos)}</p>
                <p>
                  Severidade: {missing(r.severidade)} | Probabilidade: {missing(r.probabilidade)} |
                  Nível: {missing(r.nivelRisco)}
                </p>
                <p>Medidas: {missing(r.medidasPrevenconais)}</p>
              </div>
            ))}
          </section>
          <section>
            <h3 className="font-bold">5. EPIs</h3>
            {!data.episObrigatorios.length && (
              <p>EPIs não informados. Conferir necessidade no PGR.</p>
            )}
            {data.episObrigatorios.map((e, i) => (
              <div key={i} className="my-2">
                <p>
                  {missing(e.equipamento)} — CA: {missing(e.ca)}
                </p>
                <p>
                  Uso: {missing(e.obrigatoriedade)} | Finalidade: {missing(e.finalidade)}
                </p>
              </div>
            ))}
          </section>
          <section>
            <h3 className="font-bold">6. Instruções de segurança</h3>
            <PreviewList
              values={data.regrasSeguranca.map((r) => r.descricao)}
              empty="Instruções específicas pendentes de revisão técnica."
            />
          </section>
          <section>
            <h3 className="font-bold">7. Proibições aplicáveis</h3>
            <PreviewList values={data.proibicoesExpressas} empty="Proibições não informadas." />
          </section>
          <section>
            <h3 className="font-bold">8. Procedimentos de emergência</h3>
            <PreviewList
              values={data.procedimentosEmergencia}
              empty="Informar procedimentos, contatos e recursos aplicáveis ao local."
            />
          </section>
          <section>
            <h3 className="font-bold">9. Orientações gerais</h3>
            <p className="whitespace-pre-wrap">{missing(data.orientacoesGerais)}</p>
          </section>
          <section className="space-y-5">
            <h3 className="font-bold">10. Ciência e assinaturas</h3>
            <p>{workOrderAcknowledgement(data)}</p>
            <p>
              ________________________________
              <br />
              {missing(data.colaborador.nome)}
              <br />
              Assinatura do colaborador / data: ____/____/________
            </p>
            <p>
              ________________________________
              <br />
              {missing(data.responsavelSst.nome)}
              <br />
              {missing(data.responsavelSst.cargo)} /{" "}
              {missing(data.responsavelSst.registroProfissional)}
              <br />
              Assinatura do responsável / data: ____/____/________
            </p>
          </section>
        </article>
      </div>
      <style>{`@media print { body * { visibility: hidden; } #work-order-preview, #work-order-preview * { visibility: visible; } #work-order-preview { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
    </div>
  );
}
