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
  logoArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  title: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
    color: "#001F3F",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 9,
    textAlign: "center",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 20,
  },

  dateLocation: { textAlign: "right", marginBottom: 30, fontSize: 10 },

  recipient: { marginBottom: 20 },
  recipientTitle: { fontWeight: "bold", marginBottom: 2 },

  section: { marginBottom: 20 },
  sectionHeader: {
    backgroundColor: "#f8fafc",
    padding: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#001F3F",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: "#001F3F", textTransform: "uppercase" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  gridItem: { width: "48%", marginBottom: 5 },
  label: { fontSize: 8, fontWeight: "bold", color: "#64748b", textTransform: "uppercase" },
  value: { fontSize: 10, color: "#1e293b", marginTop: 2 },

  paragraph: { marginBottom: 10, lineHeight: 1.6, textAlign: "justify", fontSize: 10 },
  bold: { fontWeight: "bold" },

  signatureArea: { marginTop: 60, alignItems: "center" },
  signatureLine: {
    width: 250,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    marginBottom: 5,
  },
  signerName: { fontSize: 10, fontWeight: "bold", color: "#001F3F" },
  signerRole: { fontSize: 8, color: "#64748b", textAlign: "center" },

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

export const MedicalReferralReport = ({ data, company, doctor }: any) => {
  const today = new Date();
  const formattedDate = `${today.getDate()} de ${today.toLocaleString("pt-BR", { month: "long" })} de ${today.getFullYear()}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoArea}>
            <Text style={{ fontSize: 12, fontWeight: "bold", color: "#001F3F" }}>
              {company?.name || "UNIDADE CONTRATANTE"}
            </Text>
            <Text style={{ fontSize: 8, color: "#94a3b8" }}>PLATAFORMA NAI</Text>
          </View>
          <Text style={styles.title}>MINUTA DE ENCAMINHAMENTO AO INSS</Text>
        </View>

        <View style={styles.dateLocation}>
          <Text>
            {company?.city || "Unidade"} - {company?.state || "Local"}, {formattedDate}.
          </Text>
        </View>

        <View style={styles.recipient}>
          <Text style={styles.recipientTitle}>Ao Ilmo. Sr(a). Médico(a) Perito(a) do INSS</Text>
          <Text>Ref.: Avaliação de Incapacidade Laborativa e Definição de Nexo Causal</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1. IDENTIFICAÇÃO DO TRABALHADOR</Text>
          </View>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Nome</Text>
              <Text style={styles.value}>{data.employeeName}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>CPF</Text>
              <Text style={styles.value}>{data.cpf || "---"}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Cargo/Função</Text>
              <Text style={styles.value}>{data.jobRole || "Não informado"}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Data de Admissão</Text>
              <Text style={styles.value}>{data.admissionDate || "---"}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Último Dia Trabalhado (DUT)</Text>
              <Text style={styles.value}>{data.dut || "---"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>2. QUADRO CLÍNICO E DIAGNÓSTICO</Text>
          </View>
          <Text style={styles.paragraph}>
            Descrição e CID informados no cadastro. Avaliação médica e documentos de referência
            pendentes de conferência.
          </Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Queixa Principal</Text>
              <Text style={styles.value}>{data.disease}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Diagnóstico / CID-10</Text>
              <Text style={styles.value}>
                {data.cid} - {data.disease}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>3. ANÁLISE OCUPACIONAL E PROFISSIOGRÁFICA</Text>
          </View>
          <Text style={styles.paragraph}>
            Registrar a atividade exercida, as exposições documentadas e as referências individuais
            do PGR, da AET e dos ASOs, após conferência pelo médico.
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. PARECER MÉDICO</Text>
          <Text style={styles.paragraph}>
            Conclusão sobre capacidade e nexo pendente de parecer individual identificado e
            assinado.
          </Text>
        </View>
        <Text style={styles.footer}>Minuta para revisão e assinatura profissional · NAI</Text>
      </Page>
    </Document>
  );
};
