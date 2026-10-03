"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export interface Appointment {
  agendamento_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  data_hora: string;
  check_in_at?: string;
  tipo: "Admissional" | "Periódico" | "Demissional" | "Mudança de Função" | "Retorno ao Trabalho";
  status: "Agendado" | "Em Espera" | "Em Atendimento" | "Concluído";
  check_in_realizado: boolean;
  companyId: string;
}

/**
 * Hook para monitoramento em tempo real da fila de atendimentos do dia.
 */
export function useAppointmentsQueue() {
  const db = useFirestore();
  const [data, setData] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!db) return;

    // Filtra apenas agendamentos do dia atual
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    const q = query(
      collection(db, "agendamentos"),
      where("data_hora", ">=", startOfDay),
      where("data_hora", "<=", endOfDay),
      orderBy("data_hora", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const appointmentsData = snapshot.docs.map((doc) => ({
          agendamento_id: doc.id,
          ...doc.data(),
        })) as Appointment[];

        // Prioriza a ordenação por horário de check-in para quem está "Em Espera"
        const sortedData = [...appointmentsData].sort((a, b) => {
          if (
            a.status === "Em Espera" &&
            b.status === "Em Espera" &&
            a.check_in_at &&
            b.check_in_at
          ) {
            return a.check_in_at.localeCompare(b.check_in_at);
          }
          return 0;
        });

        setData(sortedData);
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao buscar a fila de agendamentos:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db]);

  return { data, appointments: data, loading, error };
}
