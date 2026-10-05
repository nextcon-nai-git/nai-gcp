export const AVP_SOURCE = {
  spreadsheetId: "15it07WoyDRsGs2GdhWgi3zgT8yO2pYYUquPZtzFEa6Q",
  sheetId: 1413127031,
  sheetTitle: "Fila de Agendamentos",
  url: "https://docs.google.com/spreadsheets/d/15it07WoyDRsGs2GdhWgi3zgT8yO2pYYUquPZtzFEa6Q/edit?usp=drivesdk",
  intervalSeconds: 600,
} as const;

export const AVP_SOURCE_HEADERS = [
  "Nº",
  "URGÊNCIA",
  "DATA DO PEDIDO",
  "DIAS PARADO",
  "CIDADE",
  "COLABORADOR",
  "EXAME",
  "TELEFONE DO GESTOR",
  "O QUE FAZER",
  "STATUS",
  "RESPONSÁVEL",
  "DATA AGENDADA",
  "OBSERVAÇÕES",
  "TIPO DE SOLICITAÇÃO",
  "NOME CLÍNICA",
  "TELEFONE",
  "EMAIL",
  "VALOR ASO",
  "CNPJ",
  "CHAVE PIX",
  "PIX REALIZADO?",
  "ENDEREÇO CLÌNICA",
] as const;

export const AVP_CREDENCIAMENTO_MESSAGE =
  "Olá!\nSomos a Nextcon Saúde (NXC SST Empresarial LTDA - CNPJ: 44.337.647/0001-89).\n" +
  "Poderiam enviar o CNPJ e a chave PIX de vocês para o cadastro e o valor de cada ASO para credenciados?\n" +
  "Temos um grande cliente de um grupo educacional com ASOs somente clínicos que nos paga R$40 por exame. Qual valor vocês têm para credenciados?";
