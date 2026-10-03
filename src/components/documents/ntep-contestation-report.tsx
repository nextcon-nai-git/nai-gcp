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

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>{company?.name || "UNIDADE CONTRATANTE"}</Text>, inscrita no
          CNPJ sob o nº {company?.cnpj || "---"}, com sede em {company?.city || "---"} -{" "}
          {company?.state || "---"}, vem, tempestiva e respeitosamente, à presença de Vossa
          Senhoria, com fulcro no Art. 21-A, §1º da Lei nº 8.213/91 apresentar a presente:
        </Text>

        <Text style={styles.title}>CONTESTAÇÃO ADMINISTRATIVA AO NTEP</Text>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>1. DA TEMPESTIVIDADE</Text>
          <Text style={styles.paragraph}>
            A empresa tomou ciência do deferimento do benefício acidentário (B91) na data de{" "}
            {data.knowledgeDate
              ? new Date(data.knowledgeDate).toLocaleDateString("pt-BR")
              : "[Data da Ciência]"}
            . Portanto, o presente requerimento encontra-se tempestivo, protocolado dentro do prazo
            legal de 15 (quinze) dias.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>2. BREVE SÍNTESE DOS FATOS</Text>
          <Text style={styles.paragraph}>
            O segurado foi admitido em{" "}
            {data.admissionDate ? new Date(data.admissionDate).toLocaleDateString("pt-BR") : "---"}{" "}
            para exercer a função de {data.jobRole || "---"}. Em virtude do CID-10 {data.cid}, o
            benefício foi enquadrado na espécie 91 (Acidentário) presumivelmente por aplicação do
            NTEP. Ressalta-se que a CAT não foi emitida, pois inexiste acidente de trabalho.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>3. DO DIREITO E DA ELISÃO DO NEXO CAUSAL</Text>
          <Text style={styles.paragraph}>
            A requerente demonstra, através dos laudos técnicos de SST vigentes, que o ambiente de
            trabalho não foi o causador da patologia:
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>AET e PGR:</Text> A função de {data.jobRole} não expõe o
            segurado a riscos ergonômicos ou físicos capazes de desencadear o CID {data.cid}.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Parecer Médico:</Text> O relatório do Médico do Trabalho
            (PCMSO) atesta o caráter degenerativo/extra-laboral da patologia, neutralizando a
            presunção do NTEP conforme Art. 20, §1º da Lei 8.213/91.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>4. DOS PEDIDOS</Text>
          <Text style={styles.paragraph}>Diante do exposto, REQUER:</Text>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text> O recebimento desta contestação por ser própria e tempestiva;</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text> O AFASTAMENTO do Nexo Técnico Epidemiológico (NTEP);</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text> A CONVERSÃO do benefício B91 para a espécie B31 (Auxílio Comum).</Text>
            </View>
          </View>
        </View>

        <View style={styles.signatureArea}>
          <View style={styles.signatureLine} />
          <Text style={styles.signerName}>{currentUser?.name || "Responsável Legal"}</Text>
          <Text style={styles.signerRole}>{company?.name || "Empresa"}</Text>
        </View>

        <Text style={styles.footer}>
          Documento gerado via NextCon Intelligence - NAI Forensic Engine 2026
        </Text>
      </Page>
    </Document>
  );
};
