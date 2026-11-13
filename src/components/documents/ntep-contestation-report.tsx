"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 50, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  header: {
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#001F3F",
    paddingBottom: 15,
  },
  title: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#001F3F",
    textTransform: "uppercase",
  },

  infoBox: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderLeftWidth: 3,
    borderLeftColor: "#001F3F",
  },
  infoText: { fontSize: 10, marginBottom: 2, fontWeight: "bold" },

  salutation: { marginBottom: 20, lineHeight: 1.5 },

  section: { marginBottom: 15 },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#001F3F",
    textTransform: "uppercase",
    marginBottom: 8,
  },

  paragraph: { marginBottom: 10, lineHeight: 1.6, textAlign: "justify" },
  bold: { fontWeight: "bold" },

  list: { marginLeft: 15, marginBottom: 10 },
  listItem: { marginBottom: 5, flexDirection: "row" },
  bullet: { width: 10 },

  signatureArea: { marginTop: 50, alignItems: "center" },
  signatureLine: {
    width: 250,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    marginBottom: 5,
  },
  signerName: { fontSize: 10, fontWeight: "bold", color: "#001F3F" },
  signerRole: { fontSize: 8, color: "#64748b" },

  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
    borderTopWidth: 0.5,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
});

export const NtepContestationReport = ({ data, company, currentUser }: any) => {
  const today = new Date();
  const formattedDate = `${today.getDate()} de ${today.toLocaleString("pt-BR", { month: "long" })} de ${today.getFullYear()}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={{ fontSize: 12, fontWeight: "bold", color: "#001F3F" }}>
            ILUSTRÍSSIMO SENHOR GERENTE EXECUTIVO DA AGÊNCIA DA PREVIDÊNCIA SOCIAL
          </Text>
          <Text style={{ fontSize: 10, fontWeight: "bold", color: "#64748b" }}>
            {company?.city || "UNIDADE"} - {company?.state || "UF"}
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Ref.: Requerimento de Não Aplicação do Nexo Técnico Epidemiológico (NTEP)
          </Text>
          <Text style={styles.infoText}>
            Benefício (NB): {data.benefitNumber || "[Número do Benefício]"}
          </Text>
          <Text style={styles.infoText}>Segurado: {data.employeeName}</Text>
          <Text style={styles.infoText}>CPF: {data.cpf || "---"}</Text>
        </View>

        <Text style={styles.title}>MINUTA DE CONTESTAÇÃO ADMINISTRATIVA AO NTEP</Text>
        <Text style={styles.paragraph}>
          Empresa: {company?.name || "Pendente"} · CNPJ: {company?.cnpj || "Pendente"}
        </Text>
        <Text style={styles.paragraph}>
          Descrição e CID informados: {data.disease || "Pendente"} · {data.cid || "Pendente"}.
          Função: {data.jobRole || "Pendente"}.
        </Text>
        <Text style={styles.sectionHeader}>Ciência e protocolo</Text>
        <Text style={styles.paragraph}>
          Data de ciência informada: {data.knowledgeDate || "Pendente"}. Conferir decisão, espécie
          do benefício, prazo aplicável e comprovante de protocolo.
        </Text>
        <Text style={styles.sectionHeader}>Fundamentação individual</Text>
        <Text style={styles.paragraph}>
          Identificar os documentos efetivamente conferidos, inclusive CAT quando aplicável,
          exposição ocupacional e parecer médico individual. Fundamentação, pedidos e assinatura do
          responsável aguardam revisão.
        </Text>
        <Text style={styles.footer}>Minuta para revisão · NAI</Text>
      </Page>
    </Document>
  );
};
