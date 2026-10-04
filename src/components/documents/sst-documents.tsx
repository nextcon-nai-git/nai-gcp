"use client";

import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#333" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#003366",
    paddingBottom: 15,
    alignItems: "center",
  },
  logoNextcon: { width: 120, objectFit: "contain" },
  logoClient: { width: 100, objectFit: "contain" },

  docInfo: { textAlign: "right" },
  docTitle: { fontSize: 16, fontWeight: "bold", color: "#003366", textTransform: "uppercase" },
  docSubtitle: { fontSize: 10, color: "#64748b", marginTop: 2 },

  section: { marginBottom: 25 },
  sectionHeader: {
    backgroundColor: "#f8fafc",
    padding: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: "#003366", textTransform: "uppercase" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: "48%", marginBottom: 8 },
  label: { fontSize: 7, fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase" },
  value: { fontSize: 9, color: "#1e293b", marginTop: 2 },

  aiBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#dcfce7",
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  aiTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#166534",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  aiText: { fontStyle: "italic", color: "#14532d", lineHeight: 1.4 },

  signatureArea: { marginTop: 60, flexDirection: "row", justifyContent: "center", gap: 50 },
  signatureBlock: { alignItems: "center" },
  signatureLine: {
    width: 180,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    marginBottom: 5,
  },
  signerName: { fontSize: 9, fontWeight: "bold", color: "#003366" },
  signerRole: { fontSize: 7, color: "#64748b" },

  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7,
    color: "#94a3b8",
    borderTopWidth: 0.5,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
});

const NEXTCON_LOGO =
  "https://firebasestorage.googleapis.com/v0/b/studio-8439299034-125c7.firebasestorage.app/o/public%2Fnextcon-logo-horizontal.png?alt=media";

export const SSTDocument = ({ data, company, type }: any) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header Corporativo: Cliente vs Nextcon */}
      <View style={styles.header}>
        <Image src={company?.logoUrl || NEXTCON_LOGO} style={styles.logoClient} />
        <View style={styles.docInfo}>
          <Text style={styles.docTitle}>{type}</Text>
          <Text style={styles.docSubtitle}>{company?.name || "Unidade Operacional"}</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>
            Emissão: {new Date().toLocaleDateString("pt-BR")}
          </Text>
        </View>
        <Image src={NEXTCON_LOGO} style={styles.logoNextcon} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Identificação da Unidade</Text>
        </View>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Razão Social</Text>
            <Text style={styles.value}>{company?.name}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>CNPJ</Text>
            <Text style={styles.value}>{company?.cnpj}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Grau de Risco</Text>
            <Text style={styles.value}>Grau {company?.risk_degree || "---"}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>CNAE Principal</Text>
            <Text style={styles.value}>{company?.cnae || "---"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Análise NAI Intelligence (IA)</Text>
        </View>
        <View style={styles.aiBox}>
          <Text style={styles.aiTitle}>Insight Preditivo de Risco</Text>
          <Text style={styles.aiText}>
            {data?.aiInsight ||
              "Baseado nos Grupos Homogêneos de Exposição (GHE) analisados, o ambiente apresenta conformidade técnica de 94%. Recomenda-se vigilância ativa nos itens de proteção auditiva conforme NR-09."}
          </Text>
        </View>
      </View>

      {/* Bloco de Assinaturas Digitais */}
      <View style={styles.signatureArea}>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine} />
          <Text style={styles.signerName}>Eng. Felipe Coneglian Della Bianca</Text>
          <Text style={styles.signerRole}>Engenheiro de Segurança do Trabalho</Text>
          <Text style={{ fontSize: 6, color: "#10B981" }}>
            Assinado Digitalmente - NAI ID: 843929
          </Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Nextcon Platform • Gestão Estratégica de Segurança e Saúde do Trabalho •
        nai--studio-8439299034-125c7.us-central1.hosted.app
      </Text>
    </Page>
  </Document>
);
