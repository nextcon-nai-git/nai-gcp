"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1e293b" },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#001F3F",
    paddingBottom: 15,
    textAlign: "center",
  },
  title: { fontSize: 18, fontWeight: "bold", color: "#001F3F", textTransform: "uppercase" },
  section: { marginBottom: 20, padding: 10, backgroundColor: "#f8fafc", borderRadius: 8 },
  label: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "bold",
    marginBottom: 2,
  },
  value: { fontSize: 11, color: "#0f172a", fontWeight: "bold", marginBottom: 10 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  signatureArea: {
    marginTop: 50,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 10,
    alignItems: "center",
  },
  signatureText: { fontSize: 9, color: "#1e293b" },
});

export const AsoDocument = ({ patientName, companyName, status, type }: any) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Atestado de Saúde Ocupacional (ASO)</Text>
        <Text style={{ fontSize: 9, color: "#64748b", marginTop: 5 }}>
          NEXTCON SAÚDE EMPRESARIAL - INTELIGÊNCIA NAI
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Colaborador(a)</Text>
        <Text style={styles.value}>{patientName?.toUpperCase()}</Text>

        <Text style={styles.label}>Empresa Contratante</Text>
        <Text style={styles.value}>{companyName || "UNIDADE OPERACIONAL"}</Text>

        <Text style={styles.label}>Tipo de Exame</Text>
        <Text style={styles.value}>{type || "Periódico"}</Text>
      </View>

      <View
        style={{
          marginVertical: 20,
          padding: 15,
          borderLeftWidth: 4,
          borderLeftColor: "#10B981",
          backgroundColor: "#f0fdf4",
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "bold", color: "#065f46" }}>
          RESULTADO: {status?.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 9, color: "#047857", marginTop: 5 }}>
          O trabalhador encontra-se apto para o exercício de suas funções conforme os riscos
          ocupacionais mapeados no PGR.
        </Text>
      </View>

      <View style={styles.signatureArea}>
        <Text style={styles.signatureText}>Assinado Digitalmente via Plataforma Nextcon</Text>
        <Text style={{ fontSize: 7, color: "#94a3b8", marginTop: 2 }}>
          Protocolo ICP-Brasil PAdES Ready
        </Text>
      </View>

      <Text style={styles.footer}>
        Documento gerado em {new Date().toLocaleDateString("pt-BR")} - Validade Jurídica amparada
        pela NR-07 e MP 2.200-2/2001.
      </Text>
    </Page>
  </Document>
);
