/** Synthetic non-production inputs; no person/provider identity is represented. */
export function currentEventFixture(eventType: string): any {
  const base = {
    eventType,
    ideEvento: { tpAmb: 2, indRetif: 1 },
    ideEmpregador: { tpInsc: 1, nrInsc: "12345678" },
    ideVinculo: { cpfTrab: "12345678909", matricula: "SYNTHETIC-001" },
  };
  if (eventType === "S2220")
    return {
      ...base,
      aso: {
        dtAso: "2026-10-20",
        tpAso: 1,
        resAso: 1,
        exames: [{ dtExm: "2026-10-19", procRealizado: "0295" }],
        medico: { nmMed: "Profissional Sintético", nrCrm: "12345", ufCrm: "PR" },
      },
    };
  if (eventType === "S2210")
    return {
      ...base,
      cat: {
        dtAcid: "2026-10-19",
        tpAcid: 1,
        hrAcid: "1030",
        hrsTrabAntesAcid: "0230",
        tpCat: 1,
        indCatObito: "N",
        indComunPolicia: "N",
        codSitGeradora: "200004300",
        iniciatCAT: 1,
        ultDiaTrab: "2026-10-19",
        houveAfast: "S",
        localAcidente: {
          tpLocal: 1,
          dscLograd: "Rua Sintética",
          nrLograd: "1",
          cep: "80000000",
          codMunic: "4106902",
          uf: "PR",
          ideLocalAcid: { tpInsc: 1, nrInsc: "12345678000195" },
        },
        parteAtingida: { codParteAting: "753030000", lateralidade: 0 },
        agenteCausador: { codAgntCausador: "302010200" },
        atestado: {
          dtAtendimento: "2026-10-19",
          hrAtendimento: "1130",
          indInternacao: "N",
          durTrat: 1,
          indAfast: "S",
          dscLesao: "702005000",
          codCID: "S00",
          emitente: { nmEmit: "Profissional Sintético", ideOC: 1, nrOC: "12345", ufOC: "PR" },
        },
      },
    };
  if (eventType === "S2240")
    return {
      ...base,
      infoExpRisco: {
        dtIniCondicao: "2026-10-20",
        infoAmb: [
          { localAmb: 1, dscSetor: "Setor sintético", tpInsc: 1, nrInsc: "12345678000195" },
        ],
        infoAtiv: { dscAtivDes: "Atividade sintética para teste de estrutura" },
        agNoc: [{ codAgNoc: "09.01.001" }],
        respReg: [{ cpfResp: "12345678909" }],
      },
    };
  if (eventType === "S2221")
    return {
      ...base,
      toxicologico: {
        dtExame: "2026-10-20",
        cnpjLab: "12345678000195",
        codSeqExame: "AB123456789",
        nmMed: "Profissional Sintético",
        nrCRM: "12345",
        ufCRM: "PR",
      },
    };
  if (eventType === "S2230")
    return {
      ...base,
      infoAfastamento: {
        iniAfastamento: { dtIniAfast: "2026-10-20", codMotAfast: "03", infoMesmoMtv: "N" },
        fimAfastamento: { dtTermAfast: "2026-10-22" },
      },
    };
  return {
    ...base,
    ideVinculo: { cpfTrab: "12345678909" },
    infoExclusao: { tpEvento: "S-2220", nrRecEvt: "1.1.0000000000000000001" },
  };
}
