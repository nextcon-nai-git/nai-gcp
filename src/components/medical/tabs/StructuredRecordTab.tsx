"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StructuredRecordTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prontuário estruturado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>A consulta do prontuário estruturado ainda não está conectada a esta tela.</p>
        <p className="text-muted-foreground">
          Os atendimentos de enfermagem salvos estão disponíveis na aba Atendimentos. A
          indisponibilidade desta consulta não significa ausência de histórico clínico.
        </p>
      </CardContent>
    </Card>
  );
}
