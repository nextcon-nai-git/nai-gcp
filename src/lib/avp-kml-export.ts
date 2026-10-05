import type { GrupoAvpAso } from "./grupo-avp-asos-data";
import { aggregateAvpLocalities } from "./avp-geo-data";
import { avpCostSummary, formatBrlCents } from "./avp-costs";
import { parseClinicAndPhoneCells, formatBrazilianWhatsApp } from "./avp-clinic-intelligence";
import { AVP_CREDENCIAMENTO_MESSAGE } from "./avp-source-config";
import { verifiedAvpClinicsForCity } from "./avp-verified-clinics";

const escape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const link = (url: string, label: string) => `<a href="${escape(url)}">${escape(label)}</a>`;
/** Exportação sem nomes de colaboradores, documentos clínicos ou credenciais de acesso. */
export function buildAvpKml(asos: GrupoAvpAso[], now = new Date()) {
  const places = aggregateAvpLocalities(asos).filter((loc) => loc.geoKnown);
  const pins = places
    .map((loc) => {
      const costs = avpCostSummary(loc.asos);
      const style = costs.aboveTarget ? "above" : costs.missing ? "unknown" : "within";
      const contacts = new Map<string, { nome: string; url: string; phone: string }>();
      for (const aso of loc.asos)
        for (const clinic of parseClinicAndPhoneCells(
          aso.nomeClinica,
          aso.telefoneClinica,
          AVP_CREDENCIAMENTO_MESSAGE
        ))
          if (clinic.nome && !contacts.has(clinic.nome.toUpperCase()))
            contacts.set(clinic.nome.toUpperCase(), {
              nome: clinic.nome,
              url: clinic.whatsappUrl,
              phone: clinic.telefoneFormatado,
            });
      const clinicHtml = Array.from(contacts.values())
        .map(
          (clinic) =>
            `<li>${escape(clinic.nome)} · ${escape(clinic.phone)} ${clinic.url ? link(clinic.url, "WhatsApp com mensagem") : "Contato pendente"}</li>`
        )
        .join("");
      const options = verifiedAvpClinicsForCity(loc.cidade, loc.uf)
        .map(
          (clinic) =>
            `<li>${escape(clinic.nome)} · ${escape(clinic.telefone)} ${clinic.whatsapp ? link(formatBrazilianWhatsApp(clinic.whatsapp, AVP_CREDENCIAMENTO_MESSAGE).waUrl, "WhatsApp com mensagem") : ""} · ${link(clinic.sourceUrl, "Site")}</li>`
        )
        .join("");
      const live = link(
        `https://www.nai.nextconsaude.com.br/clients/grupo-avp?city=${encodeURIComponent(loc.asos[0].cidade)}&uf=${encodeURIComponent(loc.uf)}`,
        "Abrir fila e atualizar opções no NAI (login necessário)"
      );
      const maps = link(
        `https://www.google.com/maps/search/${encodeURIComponent(`clínica medicina do trabalho ASO ${loc.cidade} ${loc.uf}`)}`,
        "Buscar mais clínicas no Maps"
      );
      const html = `<h3>${escape(loc.cidade)}/${escape(loc.uf)}</h3><p>${loc.totalAsos} solicitações · ${costs.aboveTarget} acima de R$40 · ${costs.missing} sem cotação única.</p><p>Maior custo: ${costs.maximumCostCents === null ? "não informado" : escape(formatBrlCents(costs.maximumCostCents))}.</p><p>Posição de referência do município. Valores e contatos correspondem à exportação de ${escape(now.toISOString())}.</p><h4>Clínicas da planilha</h4><ul>${clinicHtml || "<li>Contato ainda não informado</li>"}</ul>${costs.aboveTarget ? `<h4>Opções para credenciamento</h4><ul>${options || "<li>Consulte as opções atualizadas no NAI e no Maps.</li>"}</ul>` : ""}<p>${live}</p><p>${maps}</p>`;
      const point = `<Point><coordinates>${loc.lng},${loc.lat},0</coordinates></Point>`;
      return (
        `<Placemark><name>${escape(loc.cidade)}/${escape(loc.uf)}</name><styleUrl>#${style}</styleUrl><description><![CDATA[${html}]]></description>${point}</Placemark>` +
        (costs.aboveTarget
          ? `<Placemark><name>Opções de clínicas — ${escape(loc.cidade)}/${escape(loc.uf)}</name><styleUrl>#alternatives</styleUrl><description><![CDATA[${html}]]></description>${point}</Placemark>`
          : "")
      );
    })
    .join("\n");
  const style = (id: string, color: string, diamond = false) =>
    `<Style id="${id}"><IconStyle><color>${color}</color><scale>1.1</scale>${diamond ? "<heading>45</heading>" : ""}<Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_${diamond ? "square" : "circle"}.png</href></Icon></IconStyle></Style>`;
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>AVP — Custos e clínicas</name><description>Exportação da fila vigente; abra o NAI para informações atualizadas. Cidades sem coordenadas confirmadas permanecem na planilha.</description>${style("above", "ff4444ef")}${style("within", "ff81b910")}${style("unknown", "ff8b7464")}${style("alternatives", "ffeb6325", true)}${pins}</Document></kml>`;
}
