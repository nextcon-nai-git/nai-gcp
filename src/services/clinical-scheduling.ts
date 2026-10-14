import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

export interface ClinicalAppointmentInput {
  companyId: string;
  employeeId: string;
  date: string;
  time: string;
  type: string;
}

function requireDocumentId(value: string) {
  if (
    !value ||
    value.length > 128 ||
    /[\/\u0000]/.test(value) ||
    ["all", "unauthorized"].includes(value)
  )
    throw new Error("Selecione uma empresa e um colaborador válidos.");
}

export async function createClinicalAppointment(db: Firestore, input: ClinicalAppointmentInput) {
  requireDocumentId(input.companyId);
  requireDocumentId(input.employeeId);
  const date = new Date(`${input.date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.date ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time) ||
    ![
      "Admissional",
      "Periódico",
      "Retorno ao Trabalho",
      "Mudança de Riscos",
      "Demissional",
    ].includes(input.type)
  )
    throw new Error("Confira a data, o horário e o tipo de exame.");

  const companyRef = doc(db, "companies", input.companyId);
  const employeeRef = doc(companyRef, "employees", input.employeeId);
  const appointmentRef = doc(collection(companyRef, "agendamentos"));
  return runTransaction(db, async (tx) => {
    const company = await tx.get(companyRef);
    const employee = await tx.get(employeeRef);
    const companyData = company.data();
    const employeeData = employee.data();
    if (
      !company.exists() ||
      !employee.exists() ||
      companyData?.isDeleted === true ||
      employeeData?.isDeleted === true ||
      (employeeData?.companyId && employeeData.companyId !== input.companyId) ||
      typeof companyData?.name !== "string" ||
      !companyData.name.trim() ||
      typeof employeeData?.name !== "string" ||
      !employeeData.name.trim()
    )
      throw new Error(
        "Empresa ou colaborador não encontrado. Atualize a seleção antes de agendar."
      );

    tx.set(appointmentRef, {
      colaborador_id: input.employeeId,
      colaborador_nome: employeeData.name,
      companyId: input.companyId,
      companyName: companyData.name,
      data_hora: `${input.date}T${input.time}:00`,
      tipo: input.type,
      status: "Agendado",
      check_in_realizado: false,
      createdAt: serverTimestamp(),
    });
    return { id: appointmentRef.id, employeeName: employeeData.name };
  });
}

export async function advanceClinicalAppointment(
  db: Firestore,
  companyId: string,
  appointmentId: string,
  next: "Em Espera" | "Em Atendimento"
) {
  requireDocumentId(companyId);
  requireDocumentId(appointmentId);
  const ref = doc(db, "companies", companyId, "agendamentos", appointmentId);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!snapshot.exists() || (data?.companyId && data.companyId !== companyId))
      throw new Error("Agendamento não encontrado. Atualize a fila.");
    const expected = next === "Em Espera" ? "Agendado" : "Em Espera";
    if (data?.status !== expected)
      throw new Error("O status do agendamento mudou. Atualize a fila antes de continuar.");
    tx.update(ref, {
      status: next,
      ...(next === "Em Espera"
        ? { check_in_realizado: true, check_in_at: new Date().toISOString() }
        : {}),
    });
  });
}
