"use client";

import * as React from "react";
import { clinicalEngine, type DadosPaciente } from "@/services/clinical-rules/engine";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, FileJson } from "lucide-react";

const EXEMPLO_FICTICIO: DadosPaciente = {
  nome: "Exemplo fictício — sem paciente real",
  peso: 85,
  altura: 1.55,
  pas: 145,
  pad: 90,
  glicemia_jejum: 135,
  hba1c: 7.1,
  asa_score: 2,
  linhas_ativadas: ["hipertensao", "diabetes", "obesidade", "cirurgia"],
};

type Summary = ReturnType<typeof clinicalEngine.avaliarPaciente>;

export default function ClinicalEnginePage() {
  const [jsonInput, setJsonInput] = React.useState("");
  const [inputSource, setInputSource] = React.useState<"manual" | "example">("manual");
  const [resultados, setResultados] = React.useState<Summary | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleRunEngine = () => {
    setError(null);
    setResultados(null);
    try {
      const dados: unknown = JSON.parse(jsonInput);
      if (!dados || typeof dados !== "object" || Array.isArray(dados))
        throw new Error("Invalid input");
      const results = clinicalEngine.avaliarPaciente(dados as DadosPaciente);
      if (results.length === 0) {
        setError("Informe ao menos uma linha em linhas_ativadas para preparar o resumo.");
        return;
      }
      setResultados(results);
    } catch {
      setError("Confira o objeto JSON e a lista linhas_ativadas. O resumo permanece pendente.");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in-95">
      <div className="flex items-center gap-4 border-b pb-6">
        <div className="p-4 bg-primary/10 rounded-2xl">
          <Activity className="size-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-[#001F3F] tracking-tight">
            Conferência preliminar de dados clínicos
          </h1>
          <p className="text-slate-500 font-medium">
            Valores informados e cálculos aritméticos para revisão por profissional habilitado.
          </p>
        </div>
      </div>

      <p
        role="status"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        Revisão profissional pendente. A validade da entrada é apenas estrutural; os resultados não
        têm validação clínica e não definem diagnóstico, prescrição ou liberação.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <label
            htmlFor="clinical-json"
            className="flex items-center gap-2 text-[#001F3F] font-bold"
          >
            <FileJson className="size-5" /> Dados informados (JSON)
          </label>
          <p className="text-sm text-slate-600">
            {inputSource === "example"
              ? "Exemplo fictício para conferência — sem paciente real."
              : "Entrada manual para conferência. Preserve os valores e o relato originais."}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setJsonInput(JSON.stringify(EXEMPLO_FICTICIO, null, 2));
              setInputSource("example");
              setResultados(null);
              setError(null);
            }}
          >
            Carregar exemplo fictício
          </Button>
          <textarea
            id="clinical-json"
            className="w-full h-[500px] p-4 font-mono text-sm bg-slate-900 text-slate-100 rounded-2xl shadow-inner focus:outline-none focus:ring-2 focus:ring-primary"
            value={jsonInput}
            onChange={(event) => {
              setJsonInput(event.target.value);
              setInputSource("manual");
              setResultados(null);
              setError(null);
            }}
          />
          {error && (
            <p role="alert" className="text-red-500 font-bold text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </p>
          )}
          <Button
            onClick={handleRunEngine}
            className="w-full h-14 bg-primary text-white font-black text-lg gap-2 rounded-xl"
          >
            <Activity className="size-5" /> Conferir dados informados
          </Button>
        </div>

        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-[#001F3F] font-bold">
            <Activity className="size-5" /> Resumo preliminar
          </h2>
          <div className="bg-slate-50 rounded-2xl p-6 min-h-[500px] border shadow-sm space-y-4 overflow-y-auto">
            {resultados === null ? (
              <p className="text-slate-500 font-medium">
                Nenhum resumo disponível. Informe os dados para conferência.
              </p>
            ) : (
              resultados.map((res) => (
                <Card key={res.codigo} className="border-l-4 border-l-primary shadow-sm">
                  <CardHeader className="py-3 px-4 bg-slate-100/50">
                    <CardTitle className="text-sm font-black uppercase text-slate-700">
                      {res.linha}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-sm">
                    <p className="font-medium text-[#001F3F]">{res.escore}</p>
                    <p className="text-slate-600">
                      {res.inputValidity === "VALID"
                        ? "Estrutura da entrada conferida; avaliação clínica pendente."
                        : "Entrada incompleta ou inválida; avaliação clínica pendente."}
                    </p>
                    <p className="text-slate-700">{res.conduta}</p>
                    <details>
                      <summary className="cursor-pointer font-semibold">
                        Valores informados para esta linha
                      </summary>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs">
                        {JSON.stringify(res.reportedData, null, 2)}
                      </pre>
                    </details>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
