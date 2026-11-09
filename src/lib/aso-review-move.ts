import type { AsoPipelineStep, AsoRequest } from "@/types/aso-scheduler-types";

export type BoardMoveExpectation = {
  from: AsoPipelineStep;
  updatedAt: string | null;
  undoId?: string;
};

export type BoardMoveReceipt = {
  id: string;
  from: AsoPipelineStep;
  to: AsoPipelineStep;
  updatedAt: string;
};

export function reviewMoveError(existing: AsoRequest, target: AsoPipelineStep): string | null {
  const evidenceRequired: Partial<Record<AsoPipelineStep, string>> = {
    agendado: "Registre a confirmação da clínica e a data do agendamento na esteira de ASOs.",
    kit_montado: "Registre o pedido e o kit emitidos no SOC na esteira de ASOs.",
    kit_enviado: "Registre o envio efetivo do kit e seu comprovante na esteira de ASOs.",
    clinica_confirmou: "Registre a confirmação recebida da clínica na esteira de ASOs.",
    exame_realizado:
      "Registre a evidência do comparecimento e do exame realizado na esteira de ASOs.",
    aso_concluido:
      "Registre o ASO conferido, seu arquivamento e o comprovante de entrega ao cliente na esteira de ASOs.",
  };
  const error = evidenceRequired[target];
  if (error) return error;
  if (
    target === "exames_definidos" &&
    (existing.validationPassed !== true || !existing.exams?.length)
  )
    return "Registre a revisão dos exames com o PCMSO antes de defini-los como confirmados.";
  if (
    target === "clinica_selecionada" &&
    (existing.validationPassed !== true ||
      !existing.clinicId ||
      !existing.clinicName ||
      existing.clinicName === "A confirmar")
  )
    return "Registre a clínica confirmada para este atendimento.";
  if (existing.status === target) return null;
  const next: Partial<Record<AsoPipelineStep, AsoPipelineStep>> = {
    solicitado: "validando",
    validando: "exames_definidos",
    exames_definidos: "clinica_selecionada",
  };
  if (next[existing.status] !== target)
    return "A etapa foi alterada ou o avanço não é permitido. Atualize o card e conclua a etapa atual.";
  return null;
}
