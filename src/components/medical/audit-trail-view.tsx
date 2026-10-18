"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function AuditTrailView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trilha de auditoria médica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>A consulta dos eventos de auditoria do servidor não está conectada a este componente.</p>
        <p className="text-muted-foreground">
          Nenhum evento de exemplo foi criado. Esta tela não comprova a existência, integridade ou
          ausência de registros de auditoria.
        </p>
      </CardContent>
    </Card>
  );
}
