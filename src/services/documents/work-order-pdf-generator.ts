import { jsPDF } from "jspdf";
import { isValidCpf } from "@/lib/cpf";
import { isValidCnpj } from "@/lib/cnpj";
import type { WorkOrderData, WorkOrderEmployeeInfo } from "@/types/work-order";

export function getDefaultWorkOrderData(
  employee: Partial<WorkOrderEmployeeInfo> = {}
): WorkOrderData {
  return {
    id: "",
    numeroControle: "",
    versaoPgr: "",
    vigenciaPgr: "",
    empresa: {
      razaoSocial: "",
      nomeFantasia: "",
      cnpj: "",
      cnae: "",
      grauRisco: "",
      endereco: "",
      cidadeUf: "",
      contratante: "",
      unidadeOperacional: "",
    },
    colaborador: {
      nome: "",
      cpf: "",
      matricula: "",
      cargo: "",
      setor: "",
      ghe: "",
      dataAdmissao: "",
      dataEmissaoOs: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      ...employee,
    },
    descricaoAtividades: [],
    riscosIdentificados: [],
    episObrigatorios: [],
    regrasSeguranca: [],
    proibicoesExpressas: [],
    procedimentosEmergencia: [],
    orientacoesGerais: "",
    responsavelSst: { nome: "", cargo: "", registroProfissional: "" },
  };
}
export function validateWorkOrder(data: WorkOrderData): string | null {
  if (data.colaborador.nome.trim().length < 3 || !isValidCpf(data.colaborador.cpf))
    return "Preencha nome completo e CPF válido do colaborador.";
  if (data.empresa.razaoSocial.trim().length < 3 || !isValidCnpj(data.empresa.cnpj))
    return "Preencha razão social e CNPJ válido da empresa.";
  if (!data.colaborador.cargo.trim()) return "Informe o cargo ou função do colaborador.";
  if (!data.versaoPgr.trim() || !data.descricaoAtividades.some((v) => v.trim()))
    return "Informe a referência do PGR e as atividades da função.";
  if (data.riscosIdentificados.some((r) => !r.fatorRisco.trim() || !r.medidasPrevenconais.trim()))
    return "Complete o fator de risco e as medidas preventivas de cada risco adicionado.";
  if (data.episObrigatorios.some((e) => !e.equipamento.trim()))
    return "Informe o equipamento de cada EPI adicionado.";
  return null;
}
export function workOrderAcknowledgement(data: WorkOrderData) {
  return `Declaro que recebi de ${data.empresa.razaoSocial || "________________"} esta Ordem de Serviço referente à função ${data.colaborador.cargo || "________________"}, com as atividades, riscos e medidas de prevenção descritos neste documento. O registro de ciência e orientação deve ser confirmado pelas assinaturas abaixo.`;
}

/** Template genérico: nenhuma prescrição ou dado de outro cliente é inserido. */
export function generateWorkOrderPdf(data: WorkOrderData): jsPDF {
  const error = validateWorkOrder(data);
  if (error) throw new Error(error);
  const doc = new jsPDF();
  const left = 16,
    width = 178,
    bottom = 266;
  let y = 20;
  const continuation = () => {
    doc.addPage();
    y = 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 42, 68);
    const header: string[] = doc.splitTextToSize(
      `${data.empresa.razaoSocial} | Ordem de Serviço - continuação`,
      width
    );
    header.forEach((line) => {
      doc.text(line, left, y);
      y += 5;
    });
    y += 4;
    doc.setFont("helvetica", "normal");
  };
  const ensure = (height = 6) => {
    if (y + height > bottom) continuation();
  };
  const text = (value: string, size = 10) => {
    doc.setFontSize(size);
    doc.setTextColor(30, 41, 59);
    const lines: string[] = doc.splitTextToSize(value, width);
    for (const line of lines) {
      ensure(5);
      doc.setFontSize(size);
      doc.text(line, left, y);
      y += 5;
    }
    y += 2;
  };
  const field = (label: string, value?: string) =>
    text(`${label}: ${value?.trim() || "Não informado"}`);
  const section = (title: string) => {
    ensure(19);
    doc.setFillColor(231, 239, 247);
    doc.rect(left - 2, y - 4, width + 4, 9, "F");
    doc.setFont("helvetica", "bold");
    text(title, 11);
    doc.setFont("helvetica", "normal");
    y += 4;
  };
  const list = (values: string[], missing: string) => {
    if (!values.some((v) => v.trim())) text(missing);
    else values.filter((v) => v.trim()).forEach((v) => text(`- ${v}`));
  };
  doc.setFont("helvetica", "bold");
  text("ORDEM DE SERVIÇO DE SST - NR-01", 16);
  doc.setFont("helvetica", "normal");
  text("MINUTA - CONFERIR PGR, DADOS TÉCNICOS E ASSINATURAS", 9);
  field("Controle", data.numeroControle);
  field("Data de emissão da minuta", data.colaborador.dataEmissaoOs);
  section("1. Empregador e local de trabalho");
  field("Razão social", data.empresa.razaoSocial);
  field("Nome fantasia", data.empresa.nomeFantasia);
  field("CNPJ", data.empresa.cnpj);
  field(
    "CNAE / grau de risco",
    `${data.empresa.cnae || "Não informado"} / ${data.empresa.grauRisco || "Não informado"}`
  );
  field("Endereço", data.empresa.endereco);
  field("Cidade / UF", data.empresa.cidadeUf);
  field("Contratante", data.empresa.contratante);
  field("Unidade / local", data.empresa.unidadeOperacional);
  section("2. Colaborador e referência técnica");
  field("Nome", data.colaborador.nome);
  field("CPF", data.colaborador.cpf);
  field("Matrícula", data.colaborador.matricula);
  field("Cargo / função", data.colaborador.cargo);
  field("Setor", data.colaborador.setor);
  field("GHE / GES", data.colaborador.ghe);
  field("Admissão", data.colaborador.dataAdmissao);
  field("PGR / revisão", data.versaoPgr);
  field("Vigência do PGR", data.vigenciaPgr);
  section("3. Atividades da função");
  list(data.descricaoAtividades, "Atividades não informadas.");
  section("4. Riscos e medidas de prevenção");
  if (!data.riscosIdentificados.length)
    text(
      "Riscos não informados nesta minuta. Conferir o PGR; a ausência de preenchimento não significa ausência de riscos."
    );
  data.riscosIdentificados.forEach((r) => {
    text(`${r.grupo} - ${r.fatorRisco}`);
    field("Fontes / circunstâncias", r.fontes);
    field("Possíveis danos", r.possiveisDanos);
    field(
      "Severidade / probabilidade / nível",
      `${r.severidade || "Não informado"} / ${r.probabilidade || "Não informado"} / ${r.nivelRisco || "Não informado"}`
    );
    field("Medidas preventivas", r.medidasPrevenconais);
  });
  section("5. Equipamentos de proteção individual");
  if (!data.episObrigatorios.length)
    text("EPIs não informados. Conferir a necessidade conforme as atividades e o PGR.");
  data.episObrigatorios.forEach((e) => {
    text(e.equipamento);
    field("CA", e.ca);
    field("Condição de uso", e.obrigatoriedade);
    field("Finalidade", e.finalidade);
  });
  section("6. Instruções de segurança");
  if (!data.regrasSeguranca.length)
    text("Instruções específicas pendentes de preenchimento e revisão técnica.");
  data.regrasSeguranca.forEach((r) => {
    if (r.titulo.trim()) text(r.titulo);
    text(r.descricao);
  });
  section("7. Proibições aplicáveis");
  list(data.proibicoesExpressas, "Proibições específicas não informadas.");
  section("8. Procedimentos de emergência");
  list(
    data.procedimentosEmergencia,
    "Informar os procedimentos, contatos e recursos aplicáveis ao local."
  );
  section("9. Orientações gerais");
  text(
    data.orientacoesGerais || "Orientações adicionais pendentes de revisão do responsável por SST."
  );
  section("10. Ciência e assinaturas");
  text(workOrderAcknowledgement(data));
  ensure(100);
  y += 10;
  text("________________________________________________________________________________");
  text(`${data.colaborador.nome} | CPF: ${data.colaborador.cpf}`);
  text("Assinatura do colaborador / data: ____/____/________");
  y += 8;
  text("________________________________________________________________________________");
  field("Responsável por SST", data.responsavelSst.nome);
  field(
    "Cargo / registro",
    `${data.responsavelSst.cargo || "________________"} / ${data.responsavelSst.registroProfissional || "________________"}`
  );
  text("Assinatura do responsável / data: ____/____/________");
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(`NAI | Minuta para revisão e assinaturas | Página ${i}/${pages}`, left, 285);
  }
  return doc;
}
export function workOrderFilename(data: WorkOrderData) {
  const clean = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]/gi, "_")
      .slice(0, 70);
  return `MINUTA_OS_NR01_${clean(data.empresa.razaoSocial)}_${clean(data.colaborador.nome)}.pdf`;
}
export function downloadWorkOrderPdf(data: WorkOrderData) {
  generateWorkOrderPdf(data).save(workOrderFilename(data));
}
export function getWhatsAppOsDispatchMessage(data: WorkOrderData) {
  const error = validateWorkOrder(data);
  if (error) throw new Error(error);
  return encodeURIComponent(
    `*${data.empresa.razaoSocial}*\n*ORDEM DE SERVIÇO DE SST - NR-01*\n\nPrezado(a) ${data.colaborador.nome},\n\nA minuta da Ordem de Serviço da função ${data.colaborador.cargo} está preparada para conferência. Referência do PGR: ${data.versaoPgr}.\n\nConfira o documento, as orientações e as assinaturas com o responsável por SST.\nControle: ${data.numeroControle || "Não informado"}.\n\nEsta mensagem não inclui o PDF. Anexe o arquivo revisado antes de enviar.`
  );
}
