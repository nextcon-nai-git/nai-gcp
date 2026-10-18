"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfessionalEvolutionTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução profissional</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          A equipe e as evoluções profissionais da unidade ainda não estão conectadas a esta tela.
        </p>
        <p className="text-muted-foreground">
          O registro de plantões, a assinatura de evoluções e o protocolo de atividades não estão
          disponíveis aqui. Consulte os atendimentos salvos na aba Atendimentos.
        </p>
      </CardContent>
    </Card>
  );
}
