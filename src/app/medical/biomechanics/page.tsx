"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AGGRAVATIONS = ["Alta Repetitividade", "Postura Estática", "Peso Excessivo", "Vibração"];
const BORG = [0, 2, 4, 6, 8, 10];

export default function BiomechanicsPage() {
  const [borg, setBorg] = useState<number | null>(null);
  const [factors, setFactors] = useState<string[]>([]);
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Auditoria Biomecânica</h1>
      <p role="status">
        Avaliação não realizada. Não há medição de ângulos, cálculo RULA/REBA validado ou conclusão
        de conformidade nesta tela.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Observações para avaliação profissional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p>Percepção de esforço informada (Borg)</p>
          <div className="flex flex-wrap gap-2">
            {BORG.map((value) => (
              <Button
                key={value}
                aria-pressed={borg === value}
                variant={borg === value ? "default" : "outline"}
                onClick={() => setBorg(value)}
              >
                Nível {value}
              </Button>
            ))}
          </div>
          <fieldset className="space-y-3">
            <legend>Agravos observados</legend>
            {AGGRAVATIONS.map((label) => (
              <label key={label} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={factors.includes(label)}
                  onChange={(event) =>
                    setFactors((previous) =>
                      event.target.checked
                        ? [...previous, label]
                        : previous.filter((item) => item !== label)
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <p aria-live="polite">
            Esforço informado: {borg ?? "não informado"}. Agravos selecionados: {factors.length}.
            Estes dados não representam escore de risco ou diagnóstico.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setBorg(null);
              setFactors([]);
            }}
          >
            Limpar observações
          </Button>
        </CardContent>
      </Card>
      <p>
        Captura e análise de vídeo indisponíveis: não há processamento de vídeo conectado. As
        observações acima são locais e não foram salvas.
      </p>
      <Button disabled>Protocolar Laudo de Auditoria — avaliação validada pendente</Button>
    </div>
  );
}
