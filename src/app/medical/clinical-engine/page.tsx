"use client";

import * as React from "react";
import { clinicalEngine, DadosPaciente } from "@/services/clinical-rules/engine";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, Stethoscope, FileJson } from "lucide-react";

const EXEMPLO_MARIA: DadosPaciente = {
  nome: "Maria de Fátima Souza",
  idade: 65,
  sexo: "F",
  peso: 85,
  altura: 1.55,
  pas: 145,
  pad: 90,
  glicemia_jejum: 135,
  hba1c: 7.1,
  katz_score: 5,
  das28_score: 4.2,
  linhas_ativadas: ["hipertensao", "diabetes", "obesidade", "idoso", "reumatologia", "neoplasias"],
};

export default function ClinicalEnginePage() {
  const [jsonInput, setJsonInput] = React.useState(JSON.stringify(EXEMPLO_MARIA, null, 2));
  const [resultados, setResultados] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const handleRunEngine = () => {
    try {
      setError(null);
      const paciente = JSON.parse(jsonInput);
      const results = clinicalEngine.avaliarPaciente(paciente);
      setResultados(results);
    } catch (e: any) {
      setError("Erro ao interpretar JSON: " + e.message);
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
            Motor de Regras Clínicas
          </h1>
          <p className="text-slate-500 font-medium">
            Testador integrado das Linhas de Cuidado NAI.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Painel Esquerdo: Entrada de Dados */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#001F3F] font-bold">
            <FileJson className="size-5" /> Dados do Paciente (JSON)
          </div>
          <textarea
            className="w-full h-[500px] p-4 font-mono text-sm bg-slate-900 text-green-400 rounded-2xl shadow-inner focus:outline-none focus:ring-2 focus:ring-primary"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
          />
          {error && (
            <p className="text-red-500 font-bold text-sm bg-red-50 p-3 rounded-lg">{error}</p>
          )}
          <Button
            onClick={handleRunEngine}
            className="w-full h-14 bg-primary text-white font-black text-lg gap-2 rounded-xl"
          >
            <Stethoscope className="size-5" /> Avaliar Paciente
          </Button>
        </div>

        {/* Painel Direito: Resultados */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#001F3F] font-bold">
            <Activity className="size-5" /> Prontuário Gerado
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 min-h-[500px] border shadow-sm space-y-4 overflow-y-auto">
            {resultados.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-medium italic">
                Nenhum resultado ainda. Rode o motor.
              </div>
            ) : (
              resultados.map((res, i) => (
                <Card
                  key={i}
                  className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all"
                >
                  <CardHeader className="py-3 px-4 bg-slate-100/50">
                    <CardTitle className="text-sm font-black uppercase text-slate-700 flex justify-between items-center">
                      <span>📋 {res.linha}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-500 min-w-[70px]">Métrica:</span>
                      <span className="font-medium text-[#001F3F]">{res.escore}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-500 min-w-[70px]">Conduta:</span>
                      <span className="font-black text-primary">{res.conduta}</span>
                    </div>
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
