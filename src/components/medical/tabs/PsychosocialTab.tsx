"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PsychosocialTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores psicossociais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Não há uma fonte de avaliações psicossociais conectada a esta tela.</p>
        <p className="text-muted-foreground">
          Indicadores de estresse, risco de afastamento e correlações dependem de dados validados.
          Nenhuma previsão ou conclusão clínica foi calculada.
        </p>
        <p className="text-muted-foreground">
          Solicitações de intervenção e notificações à equipe ainda não estão disponíveis aqui.
        </p>
      </CardContent>
    </Card>
  );
}
