import { AVP_COST_BANDS, avpCostBand } from "./avp-evidence";
import { avpMapCityKey, avpMapClinicCost, type AvpMapClinic } from "./avp-map-clinics";
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
export function buildAvpKml(
  asos: GrupoAvpAso[],
  now = new Date(),
  clinics: AvpMapClinic[] = []
) {
  const places = aggregateAvpLocalities(asos, clinics).filter((loc) => loc.geoKnown);
  const pins = places
    .map((loc) => {
      const costs = avpCostSummary(loc.asos);
      const current = clinics.filter((clinic) => avpMapCityKey(clinic.cidade, clinic.uf) === loc.key);
      const mapCost = current.length ? avpMapClinicCost(current) : costs.maximumCostCents;
      const style = avpCostBand(mapCost);
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
        `https://www.nai.nextconsaude.com.br/clients/grupo-avp?city=${encodeURIComponent(loc.cidade)}&uf=${encodeURIComponent(loc.uf)}`,
        "Abrir fila e atualizar opções no NAI (login necessário)"
      );
      const maps = link(
        `https://www.google.com/maps/search/${encodeURIComponent(`clínica medicina do trabalho ASO ${loc.cidade} ${loc.uf}`)}`,
        "Buscar mais clínicas no Maps"
      );
      const currentHtml = current
        .map(
          (clinic) =>
            `<li>${escape(clinic.nome)} · ${clinic.cents === null ? "Valor não apurado" : escape(formatBrlCents(clinic.cents))} · ${escape(clinic.status)} · ${escape(clinic.notes)} · ${escape(clinic.telefone)} · ${escape(clinic.date)}</li>`
        )
        .join("");
      const html = `<h3>${escape(loc.cidade)}/${escape(loc.uf)}</h3><p>${loc.totalAsos} solicitações · ${costs.aboveTarget} acima de R$40 · ${costs.missing} sem cotação única.</p><p>Maior custo: ${costs.maximumCostCents === null ? "não informado" : escape(formatBrlCents(costs.maximumCostCents))}.</p><p>Posição de referência do município. Valores e contatos correspondem à exportação de ${escape(now.toISOString())}.</p><h4>Clínicas e valores atuais</h4><ul>${currentHtml || "<li>Sem atualização; consultar histórico da fila.</li>"}</ul><h4>Clínicas da fila</h4><ul>${clinicHtml || "<li>Contato ainda não informado</li>"}</ul>${costs.aboveTarget ? `<h4>Opções para credenciamento</h4><ul>${options || "<li>Consulte as opções atualizadas no NAI e no Maps.</li>"}</ul>` : ""}<p>${live}</p><p>${maps}</p>`;
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
  const costStyles = Object.entries(AVP_COST_BANDS)
    .map(([id, band]) => {
      const hex = band.color.slice(1);
      return style(id, `ff${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`);
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>AVP — Custos e clínicas</name><description>Exportação da fila vigente; abra o NAI para informações atualizadas. Cidades sem coordenadas confirmadas permanecem na planilha.</description>${costStyles}${style("alternatives", "ffeb6325", true)}${pins}</Document></kml>`;
}
