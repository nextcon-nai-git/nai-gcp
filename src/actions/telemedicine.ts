"use server";

/**
 * @fileOverview Server Action para integração com Google Meet API.
 * Responsável por gerar salas virtuais e salvar agendamentos no Firestore.
 * Inclui fallback de simulação caso as credenciais não estejam configuradas.
 */

import { google } from "googleapis";
import { initializeFirebase } from "@/firebase/init";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

export async function agendarConsultaMeet(data: {
  pacienteEmail: string;
  medicoEmail: string;
  dataHoraInicio: string;
  dataHoraFim: string;
  tituloConsulta?: string;
}) {
  const { pacienteEmail, medicoEmail, dataHoraInicio, dataHoraFim, tituloConsulta } = data;

  try {
    const { firestore } = initializeFirebase();
    let auth;
    let isMockMode = false;

    // 1. Verificação de Credenciais
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson && serviceAccountJson.trim() !== "") {
      try {
        const credentials = JSON.parse(serviceAccountJson);
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/calendar.events"],
        });
        console.log("NAI Telemedicine: Usando credenciais via Variável de Ambiente.");
      } catch (parseError) {
        console.error("NAI Telemedicine: Variável GOOGLE_SERVICE_ACCOUNT_JSON inválida.");
      }
    }

    // Tentativa via arquivos físicos se não houver variável de ambiente
    if (!auth) {
      const possibleFiles = ["google-service-account.json", "account.json"];
      for (const fileName of possibleFiles) {
        const filePath = path.join(process.cwd(), fileName);
        if (fs.existsSync(filePath)) {
          auth = new google.auth.GoogleAuth({
            keyFile: filePath,
            scopes: ["https://www.googleapis.com/auth/calendar.events"],
          });
          console.log(`NAI Telemedicine: Usando credenciais via arquivo ${fileName}.`);
          break;
        }
      }
    }

    let linkDoMeet = "";

    // 2. Fluxo de Geração do Link
    if (auth) {
      try {
        const calendar = google.calendar({ version: "v3", auth });
        const event = {
          summary: tituloConsulta || "Videoconsulta Nextcon",
          description: "Consulta agendada via plataforma Nextcon Saúde.",
          start: { dateTime: dataHoraInicio, timeZone: "America/Sao_Paulo" },
          end: { dateTime: dataHoraFim, timeZone: "America/Sao_Paulo" },
          attendees: [{ email: medicoEmail }, { email: pacienteEmail }],
          conferenceData: {
            createRequest: {
              requestId: `consulta-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        };

        const responseGoogle = await calendar.events.insert({
          calendarId: "primary",
          conferenceDataVersion: 1,
          requestBody: event,
        });

        linkDoMeet = responseGoogle.data.hangoutLink || "";
      } catch (apiError: any) {
        console.warn(
          "NAI Telemedicine: Google API falhou, ativando modo simulação.",
          apiError.message
        );
        isMockMode = true;
      }
    } else {
      console.warn("NAI Telemedicine: Nenhuma credencial encontrada. Ativando modo simulação.");
      isMockMode = true;
    }

    // 3. Fallback de Simulação (Para prototipagem sem chaves)
    if (isMockMode || !linkDoMeet) {
      linkDoMeet = `https://meet.google.com/mock-${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 4)}-${Math.random().toString(36).substring(2, 5)}`;
    }

    // 4. Salva o registro no Firestore
    const docRef = await addDoc(collection(firestore, "agendamentos_telemedicina"), {
      paciente_email: pacienteEmail,
      medico_email: medicoEmail,
      inicio: Timestamp.fromDate(new Date(dataHoraInicio)),
      fim: Timestamp.fromDate(new Date(dataHoraFim)),
      link_meet: linkDoMeet,
      status: "agendada",
      is_mock: isMockMode,
      createdAt: Timestamp.now(),
    });

    return {
      sucesso: true,
      id_consulta: docRef.id,
      link_meet: linkDoMeet,
      simulado: isMockMode,
    };
  } catch (error: any) {
    console.error("Erro fatal na integração de telemedicina:", error);
    return {
      sucesso: false,
      mensagem: "Erro interno ao processar agendamento. Verifique os logs do servidor.",
    };
  }
}
