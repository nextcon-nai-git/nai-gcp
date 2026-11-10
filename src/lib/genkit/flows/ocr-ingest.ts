import { privateVertexFlow, readMedia } from "../private-vertex";
import { AsoDraftSchema } from "../aso-draft";
const extract = privateVertexFlow("ocrIngestFlow", AsoDraftSchema);
export async function ocrIngestFlow(file: File) {
  const media = await readMedia(file, ["application/pdf", "image/png", "image/jpeg"]);
  return extract(
    "Transcreva um único ASO em rascunho. Classifique documento como ASO_INDIVIDUAL somente se o ASO for de um único trabalhador identificável. Preserve lacunas e assinale documentos contraditórios, ilegíveis ou com vários trabalhadores. Se houver mais de um trabalhador, deixe o CPF e os campos individuais nulos. CPF sem pontuação. Datas ISO. Tipo de exame: 0 admissional, 1 periódico, 2 retorno, 3 mudança de risco, 4 monitoração pontual, 9 demissional. Resultado: 1 apto ou 2 inapto somente se assinalado e inequívoco. Transcreva códigos das tabelas 24/27 apenas quando explícitos. Não invente CRM, aptidão, autorização para divulgar resultado ou ordem dos exames.",
    media
  );
}
